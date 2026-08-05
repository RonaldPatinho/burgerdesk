import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { normalizeEmail } from "../../domain/profile";
import { getMySqlPool, hasMySqlErrorCode, withMySqlTransaction } from "../database/mysql";
import { hashPassword, verifyPassword } from "./password";

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

interface UserRow extends RowDataPacket {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  active: number | boolean;
}

interface SessionRow extends RowDataPacket {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  expires_at: Date;
}

export interface AuthenticatedClientSession {
  sessionId: string;
  userId: string;
  fullName: string;
  email: string;
  expiresAt: string;
}

export class ClientAuthError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CREDENTIALS"
      | "EMAIL_ALREADY_EXISTS"
      | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "ClientAuthError";
  }
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validateRegistrationInput(input: {
  fullName: string;
  email: string;
  password: string;
}): void {
  if (
    input.fullName.trim().length < 2 ||
    input.fullName.trim().length > 120 ||
    input.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
    input.password.length < 8 ||
    input.password.length > 72
  ) {
    throw new ClientAuthError("INVALID_INPUT", "Los datos de registro no son válidos.");
  }
}

function validateLoginInput(input: { email: string; password: string }): void {
  if (
    input.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
    input.password.length < 8 ||
    input.password.length > 72
  ) {
    throw new ClientAuthError("INVALID_INPUT", "Los datos de acceso no son válidos.");
  }
}

async function createSessionForUser(
  user: Pick<UserRow, "id" | "full_name" | "email">,
): Promise<{ token: string; session: AuthenticatedClientSession }> {
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await getMySqlPool().execute<ResultSetHeader>(
    `INSERT INTO client_sessions
      (id, user_id, token_hash_sha256, expires_at)
     VALUES (?, ?, ?, ?)`,
    [sessionId, user.id, tokenHash(token), expiresAt],
  );
  return {
    token,
    session: {
      sessionId,
      userId: user.id,
      fullName: user.full_name,
      email: user.email,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export async function registerClient(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ token: string; session: AuthenticatedClientSession }> {
  validateRegistrationInput(input);
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const email = input.email.trim();
  try {
    await getMySqlPool().execute<ResultSetHeader>(
      `INSERT INTO client_users
        (id, full_name, email, email_normalized, phone, password_hash,
         preferred_store_id, contact_whatsapp, contact_email)
       VALUES (?, ?, ?, ?, NULL, ?, 'sede-centro', TRUE, FALSE)`,
      [id, input.fullName.trim(), email, normalizeEmail(email), passwordHash],
    );
  } catch (error: unknown) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new ClientAuthError(
        "EMAIL_ALREADY_EXISTS",
        "Ya existe una cuenta con ese correo electrónico.",
      );
    }
    throw error;
  }
  return createSessionForUser({ id, full_name: input.fullName.trim(), email });
}

export async function loginClient(input: {
  email: string;
  password: string;
}): Promise<{ token: string; session: AuthenticatedClientSession }> {
  validateLoginInput(input);
  const [rows] = await getMySqlPool().execute<UserRow[]>(
    `SELECT id, full_name, email, password_hash, active
     FROM client_users WHERE email_normalized = ? LIMIT 1`,
    [normalizeEmail(input.email)],
  );
  const user = rows[0];
  if (!user || !user.active || !(await verifyPassword(input.password, user.password_hash))) {
    throw new ClientAuthError(
      "INVALID_CREDENTIALS",
      "El correo o la contraseña no coinciden.",
    );
  }
  return createSessionForUser(user);
}

export async function getSessionByToken(
  token: string | undefined,
): Promise<AuthenticatedClientSession | null> {
  if (!token || token.length > 128) return null;
  const [rows] = await getMySqlPool().execute<SessionRow[]>(
    `SELECT s.id, s.user_id, s.expires_at, u.full_name, u.email
     FROM client_sessions s
     INNER JOIN client_users u ON u.id = s.user_id
     WHERE s.token_hash_sha256 = ? AND s.revoked_at IS NULL
       AND s.expires_at > CURRENT_TIMESTAMP(3) AND u.active = TRUE
     LIMIT 1`,
    [tokenHash(token)],
  );
  const row = rows[0];
  if (!row) return null;
  await getMySqlPool().execute(
    "UPDATE client_sessions SET last_seen_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
    [row.id],
  );
  return {
    sessionId: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    expiresAt: row.expires_at.toISOString(),
  };
}

export async function revokeSessionByToken(token: string | undefined): Promise<void> {
  if (!token || token.length > 128) return;
  await withMySqlTransaction(async (connection) => {
    await connection.execute<ResultSetHeader>(
      `UPDATE client_sessions SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3))
       WHERE token_hash_sha256 = ?`,
      [tokenHash(token)],
    );
  });
}
