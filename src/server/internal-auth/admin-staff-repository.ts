import { randomUUID } from "node:crypto";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import {
  normalizeAdminStaffCreate,
  normalizeAdminStaffUpdate,
  type AdminStaffCreateInput,
  type AdminStaffMember,
  type AdminStaffUpdateInput,
} from "../../domain/admin-staff";
import { isStaffRole } from "../../domain/internal-auth";
import { hashPassword } from "../auth/password";
import {
  getMySqlPool,
  hasMySqlErrorCode,
  withMySqlTransaction,
} from "../database/mysql";

interface AdminStaffRow extends RowDataPacket {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: string;
  active: number | boolean;
  created_at: Date;
  updated_at: Date;
}

interface LockedAdminStaffRow extends AdminStaffRow {
  username_normalized: string;
  email_normalized: string;
}

interface DuplicateRow extends RowDataPacket {
  id: string;
}

export class AdminStaffRepositoryError extends Error {
  constructor(
    public readonly code:
      | "STAFF_NOT_FOUND"
      | "STALE_STAFF"
      | "USERNAME_ALREADY_EXISTS"
      | "EMAIL_ALREADY_EXISTS",
    message: string,
  ) {
    super(message);
    this.name = "AdminStaffRepositoryError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

function toAdminStaffMember(row: AdminStaffRow): AdminStaffMember {
  if (!isStaffRole(row.role)) {
    throw new TypeError("El registro no corresponde a un rol de Personal.");
  }
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function getStaffMemberWithExecutor(
  executor: Pool | PoolConnection,
  userId: string,
): Promise<AdminStaffMember | null> {
  const [rows] = await executor.execute<AdminStaffRow[]>(
    `SELECT id, username, full_name, email, role, active, created_at, updated_at
     FROM internal_users
     WHERE id = ?
       AND role IN ('caja', 'cocina', 'caja_cocina')
     LIMIT 1`,
    [userId],
  );
  return rows[0] ? toAdminStaffMember(rows[0]) : null;
}

async function revokeStaffAccess(
  connection: PoolConnection,
  userId: string,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `UPDATE internal_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3))
     WHERE user_id = ?
       AND revoked_at IS NULL`,
    [userId],
  );
  await connection.execute<ResultSetHeader>(
    `UPDATE staff_shifts
     SET status = 'cerrado',
         ends_at = CURRENT_TIMESTAMP(3)
     WHERE user_id = ?
       AND status = 'activo'
       AND ends_at IS NULL`,
    [userId],
  );
}

export async function listAdminStaffMembers(
  search = "",
): Promise<readonly AdminStaffMember[]> {
  const normalizedSearch = search.trim().slice(0, 100);
  const values: string[] = [];
  const searchSql = normalizedSearch
    ? `AND LOCATE(?, CONCAT_WS(' ', username, full_name, email, role)) > 0`
    : "";
  if (normalizedSearch) values.push(normalizedSearch);

  const [rows] = await getMySqlPool().execute<AdminStaffRow[]>(
    `SELECT id, username, full_name, email, role, active, created_at, updated_at
     FROM internal_users
     WHERE role IN ('caja', 'cocina', 'caja_cocina')
       ${searchSql}
     ORDER BY active DESC, full_name ASC, username ASC`,
    values,
  );
  return rows.map(toAdminStaffMember);
}

export async function createAdminStaffMember(
  rawInput: AdminStaffCreateInput | unknown,
): Promise<AdminStaffMember> {
  const input = normalizeAdminStaffCreate(rawInput);
  const usernameNormalized = input.username.trim().toLowerCase();
  const emailNormalized = normalizeEmail(input.email);
  const userId = randomUUID();
  const passwordHash = await hashPassword(input.password);

  try {
    return await withMySqlTransaction(async (connection) => {
      const [usernameRows] = await connection.execute<DuplicateRow[]>(
        `SELECT id FROM internal_users WHERE username_normalized = ? LIMIT 1`,
        [usernameNormalized],
      );
      if (usernameRows[0]) {
        throw new AdminStaffRepositoryError(
          "USERNAME_ALREADY_EXISTS",
          "Ya existe una cuenta con ese nombre de usuario.",
        );
      }

      const [emailRows] = await connection.execute<DuplicateRow[]>(
        `SELECT id FROM internal_users WHERE email_normalized = ? LIMIT 1`,
        [emailNormalized],
      );
      if (emailRows[0]) {
        throw new AdminStaffRepositoryError(
          "EMAIL_ALREADY_EXISTS",
          "Ya existe una cuenta con ese correo electrónico.",
        );
      }

      await connection.execute<ResultSetHeader>(
        `INSERT INTO internal_users (
           id, username, username_normalized, full_name, email,
           email_normalized, password_hash, role, active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          userId,
          input.username.trim(),
          usernameNormalized,
          input.fullName.trim(),
          input.email.trim(),
          emailNormalized,
          passwordHash,
          input.role,
        ],
      );

      const created = await getStaffMemberWithExecutor(connection, userId);
      if (!created) throw new Error("STAFF_CREATE_READBACK_FAILED");
      return created;
    });
  } catch (error: unknown) {
    if (error instanceof AdminStaffRepositoryError) throw error;
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AdminStaffRepositoryError(
        "USERNAME_ALREADY_EXISTS",
        "Ya existe una cuenta con ese usuario o correo.",
      );
    }
    throw error;
  }
}

export async function updateAdminStaffMember(
  rawInput: AdminStaffUpdateInput | unknown,
): Promise<AdminStaffMember> {
  const inputRecord =
    typeof rawInput === "object" && rawInput !== null
      ? (rawInput as Record<string, unknown>)
      : null;
  const input = normalizeAdminStaffUpdate(
    inputRecord?.userId,
    inputRecord
      ? {
          expectedUpdatedAt: inputRecord.expectedUpdatedAt,
          patch: inputRecord.patch,
        }
      : rawInput,
  );

  return withMySqlTransaction(async (connection) => {
    const [rows] = await connection.execute<LockedAdminStaffRow[]>(
      `SELECT id, username, username_normalized, full_name, email, email_normalized, role, active,
              created_at, updated_at
       FROM internal_users
       WHERE id = ?
         AND role IN ('caja', 'cocina', 'caja_cocina')
       LIMIT 1
       FOR UPDATE`,
      [input.userId],
    );
    const current = rows[0];
    if (!current) {
      throw new AdminStaffRepositoryError(
        "STAFF_NOT_FOUND",
        "No encontramos ese empleado.",
      );
    }
    if (current.updated_at.getTime() !== Date.parse(input.expectedUpdatedAt)) {
      throw new AdminStaffRepositoryError(
        "STALE_STAFF",
        "La cuenta cambió en otra sesión. Actualiza la información e inténtalo de nuevo.",
      );
    }

    const nextUsername = input.patch.username?.trim() ?? current.username;
    const nextUsernameNormalized = nextUsername.toLowerCase();
    if (nextUsernameNormalized !== current.username_normalized) {
      const [duplicates] = await connection.execute<DuplicateRow[]>(
        `SELECT id
         FROM internal_users
         WHERE username_normalized = ? AND id <> ?
         LIMIT 1`,
        [nextUsernameNormalized, input.userId],
      );
      if (duplicates[0]) {
        throw new AdminStaffRepositoryError(
          "USERNAME_ALREADY_EXISTS",
          "Ya existe una cuenta con ese nombre de usuario.",
        );
      }
    }

    const nextEmail = input.patch.email?.trim() ?? current.email;
    const nextEmailNormalized = normalizeEmail(nextEmail);
    if (nextEmailNormalized !== current.email_normalized) {
      const [duplicates] = await connection.execute<DuplicateRow[]>(
        `SELECT id
         FROM internal_users
         WHERE email_normalized = ? AND id <> ?
         LIMIT 1`,
        [nextEmailNormalized, input.userId],
      );
      if (duplicates[0]) {
        throw new AdminStaffRepositoryError(
          "EMAIL_ALREADY_EXISTS",
          "Ya existe una cuenta con ese correo electrónico.",
        );
      }
    }

    const nextFullName = input.patch.fullName ?? current.full_name;
    const nextRole = input.patch.role ?? current.role;
    const nextActive = input.patch.active ?? Boolean(current.active);

    await connection.execute<ResultSetHeader>(
      `UPDATE internal_users
       SET username = ?,
           username_normalized = ?,
           full_name = ?,
           email = ?,
           email_normalized = ?,
           role = ?,
           active = ?,
           updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [
        nextUsername,
        nextUsernameNormalized,
        nextFullName,
        nextEmail,
        nextEmailNormalized,
        nextRole,
        nextActive,
        input.userId,
      ],
    );

    const usernameChanged = nextUsernameNormalized !== current.username_normalized;
    const roleChanged = nextRole !== current.role;
    const wasDeactivated = Boolean(current.active) && !nextActive;
    if (usernameChanged || roleChanged || wasDeactivated) {
      await revokeStaffAccess(connection, input.userId);
    }

    const updated = await getStaffMemberWithExecutor(connection, input.userId);
    if (!updated) throw new Error("STAFF_UPDATE_READBACK_FAILED");
    return updated;
  });
}
