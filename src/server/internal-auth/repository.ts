import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import {
  isAdministratorRole,
  isInternalRole,
  isStaffRole,
  normalizeUsername,
  validateInternalLogin,
  type AdministratorRole,
  type InternalRole,
  type StaffRole,
} from "../../domain/internal-auth";
import { getMySqlPool, withMySqlTransaction } from "../database/mysql";
import { verifyPassword } from "../auth/password";

export const INTERNAL_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

type InternalAccessEventType =
  | "login_success"
  | "login_failure"
  | "logout";

interface InternalUserRow extends RowDataPacket {
  id: string;
  username: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: string;
  active: number | boolean;
}

interface InternalSessionRow extends RowDataPacket {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  role: string;
  expires_at: Date;
}

interface RevocableSessionRow extends RowDataPacket {
  id: string;
  user_id: string;
  revoked_at: Date | null;
}

interface AccountOverviewRow extends RowDataPacket {
  created_at: Date;
  active_shift_starts_at: Date | null;
}

interface ActiveShiftRow extends RowDataPacket {
  id: string;
}

export interface AuthenticatedInternalSession {
  sessionId: string;
  userId: string;
  username: string;
  fullName: string;
  email: string;
  role: InternalRole;
  expiresAt: string;
}

export interface AuthenticatedStaffSession
  extends Omit<AuthenticatedInternalSession, "role"> {
  role: StaffRole;
}

export interface AuthenticatedAdministratorSession
  extends Omit<AuthenticatedInternalSession, "role"> {
  role: AdministratorRole;
}

/** Datos complementarios de la cuenta para la pantalla de perfil. */
export interface StaffAccountOverview {
  memberSince: string | null;
  activeShiftStartedAt: string | null;
}

export class InternalAuthRepositoryError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "INVALID_CREDENTIALS"
      | "NOT_AUTHORIZED",
    message: string,
  ) {
    super(message);
    this.name = "InternalAuthRepositoryError";
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isPlausibleSessionToken(token: string | undefined): token is string {
  return Boolean(token && token.length >= 32 && token.length <= 128);
}

async function insertAccessEvent(
  eventType: InternalAccessEventType,
  userId: string | null,
  connection?: PoolConnection,
): Promise<void> {
  const statement = `INSERT INTO internal_access_events
    (id, user_id, event_type)
   VALUES (?, ?, ?)`;
  const values = [randomUUID(), userId, eventType];

  if (connection) {
    await connection.execute<ResultSetHeader>(statement, values);
    return;
  }

  await getMySqlPool().execute<ResultSetHeader>(statement, values);
}

async function recordRejectedLogin(userId: string | null): Promise<void> {
  await insertAccessEvent("login_failure", userId);
}

async function ensureActiveStaffShift(
  userId: string,
  connection: PoolConnection,
): Promise<void> {
  // Lock the user row so concurrent logins for the same employee cannot
  // create two active shifts in the same transaction window.
  await connection.execute<RowDataPacket[]>(
    `SELECT id
     FROM internal_users
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [userId],
  );

  const [rows] = await connection.execute<ActiveShiftRow[]>(
    `SELECT id
     FROM staff_shifts
     WHERE user_id = ?
       AND status = 'activo'
       AND ends_at IS NULL
     ORDER BY starts_at DESC
     LIMIT 1`,
    [userId],
  );

  if (rows[0]) return;

  await connection.execute<ResultSetHeader>(
    `INSERT INTO staff_shifts (id, user_id)
     VALUES (?, ?)`,
    [randomUUID(), userId],
  );
}

function toAuthenticatedSession(
  row: InternalSessionRow,
): AuthenticatedInternalSession | null {
  if (!isInternalRole(row.role)) {
    return null;
  }

  return {
    sessionId: row.id,
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at.toISOString(),
  };
}

async function loginInternalUser<Role extends InternalRole>(
  input: {
    username: string;
    password: string;
  },
  roleGuard: (value: unknown) => value is Role,
  unauthorizedMessage: string,
  startStaffShift: boolean,
): Promise<{
  token: string;
  session: Omit<AuthenticatedInternalSession, "role"> & { role: Role };
}> {
  const validation = validateInternalLogin(input);
  const normalizedUsername = normalizeUsername(input.username);

  if (!validation.valid || !normalizedUsername) {
    throw new InternalAuthRepositoryError(
      "INVALID_INPUT",
      "Los datos de acceso no son válidos.",
    );
  }

  const [rows] = await getMySqlPool().execute<InternalUserRow[]>(
    `SELECT id, username, full_name, email, password_hash, role, active
     FROM internal_users
     WHERE username_normalized = ?
     LIMIT 1`,
    [normalizedUsername],
  );
  const user = rows[0];

  if (
    !user ||
    !user.active ||
    !(await verifyPassword(input.password, user.password_hash))
  ) {
    await recordRejectedLogin(user?.id ?? null);
    throw new InternalAuthRepositoryError(
      "INVALID_CREDENTIALS",
      "El usuario o la contraseña no coinciden.",
    );
  }

  if (!roleGuard(user.role)) {
    await recordRejectedLogin(user.id);
    throw new InternalAuthRepositoryError(
      "NOT_AUTHORIZED",
      unauthorizedMessage,
    );
  }
  const authorizedRole = user.role;

  const token = randomBytes(32).toString("base64url");
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + INTERNAL_SESSION_LIFETIME_MS);

  await withMySqlTransaction(async (connection) => {
    await connection.execute<ResultSetHeader>(
      `INSERT INTO internal_sessions
        (id, user_id, token_hash_sha256, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, user.id, hashSessionToken(token), expiresAt],
    );

    if (startStaffShift) {
      await ensureActiveStaffShift(user.id, connection);
    }

    await insertAccessEvent("login_success", user.id, connection);
  });

  return {
    token,
    session: {
      sessionId,
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: authorizedRole,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export async function loginStaff(input: {
  username: string;
  password: string;
}): Promise<{ token: string; session: AuthenticatedStaffSession }> {
  return loginInternalUser(
    input,
    isStaffRole,
    "La cuenta no tiene acceso al flujo Personal.",
    true,
  );
}

export async function loginAdministrator(input: {
  username: string;
  password: string;
}): Promise<{
  token: string;
  session: AuthenticatedAdministratorSession;
}> {
  return loginInternalUser(
    input,
    isAdministratorRole,
    "La cuenta no tiene acceso al flujo Administrador.",
    false,
  );
}

export async function getInternalSessionByToken(
  token: string | undefined,
): Promise<AuthenticatedInternalSession | null> {
  if (!isPlausibleSessionToken(token)) {
    return null;
  }

  const [rows] = await getMySqlPool().execute<InternalSessionRow[]>(
    `SELECT
       s.id,
       s.user_id,
       s.expires_at,
       u.username,
       u.full_name,
       u.email,
       u.role
     FROM internal_sessions s
     INNER JOIN internal_users u ON u.id = s.user_id
     WHERE s.token_hash_sha256 = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > CURRENT_TIMESTAMP(3)
       AND u.active = TRUE
     LIMIT 1`,
    [hashSessionToken(token)],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  const session = toAuthenticatedSession(row);
  if (!session) {
    return null;
  }

  await getMySqlPool().execute<ResultSetHeader>(
    `UPDATE internal_sessions
     SET last_seen_at = CURRENT_TIMESTAMP(3)
     WHERE id = ?`,
    [session.sessionId],
  );

  return session;
}

export async function getStaffSessionByToken(
  token: string | undefined,
): Promise<AuthenticatedStaffSession | null> {
  const session = await getInternalSessionByToken(token);
  if (!session || !isStaffRole(session.role)) {
    return null;
  }

  return {
    ...session,
    role: session.role,
  };
}

export async function getAdministratorSessionByToken(
  token: string | undefined,
): Promise<AuthenticatedAdministratorSession | null> {
  const session = await getInternalSessionByToken(token);
  if (!session || !isAdministratorRole(session.role)) {
    return null;
  }

  return {
    ...session,
    role: session.role,
  };
}

async function revokeSessionByToken(
  token: string | undefined,
  closeStaffShift: boolean,
): Promise<void> {
  if (!isPlausibleSessionToken(token)) {
    return;
  }

  const hashedToken = hashSessionToken(token);

  await withMySqlTransaction(async (connection) => {
    const [rows] = await connection.execute<RevocableSessionRow[]>(
      `SELECT id, user_id, revoked_at
       FROM internal_sessions
       WHERE token_hash_sha256 = ?
       LIMIT 1
       FOR UPDATE`,
      [hashedToken],
    );
    const session = rows[0];

    if (!session || session.revoked_at) {
      return;
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE internal_sessions
       SET revoked_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [session.id],
    );

    if (closeStaffShift) {
      await connection.execute<ResultSetHeader>(
        `UPDATE staff_shifts
         SET status = 'cerrado',
             ends_at = CURRENT_TIMESTAMP(3)
         WHERE user_id = ?
           AND status = 'activo'
           AND ends_at IS NULL`,
        [session.user_id],
      );
    }

    await insertAccessEvent("logout", session.user_id, connection);
  });
}

export async function revokeInternalSessionByToken(
  token: string | undefined,
): Promise<void> {
  await revokeSessionByToken(token, false);
}

export async function revokeStaffSessionByToken(
  token: string | undefined,
): Promise<void> {
  await revokeSessionByToken(token, true);
}

export async function getStaffAccountOverview(
  userId: string,
): Promise<StaffAccountOverview> {
  const [rows] = await getMySqlPool().execute<AccountOverviewRow[]>(
    `SELECT
       u.created_at,
       (
         SELECT s.starts_at
         FROM staff_shifts s
         WHERE s.user_id = u.id
           AND s.status = 'activo'
           AND s.ends_at IS NULL
         ORDER BY s.starts_at DESC
         LIMIT 1
       ) AS active_shift_starts_at
     FROM internal_users u
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  return {
    memberSince: row?.created_at?.toISOString() ?? null,
    activeShiftStartedAt:
      row?.active_shift_starts_at?.toISOString() ?? null,
  };
}
