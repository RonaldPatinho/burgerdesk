import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import {
  normalizeUsername,
  validateInternalUser,
} from "../src/domain/internal-auth.ts";
import { hashPassword } from "../src/server/auth/password.ts";

const ENVIRONMENT_FIELDS = {
  username: "INTERNAL_USER_USERNAME",
  password: "INTERNAL_USER_PASSWORD",
  fullName: "INTERNAL_USER_FULL_NAME",
  email: "INTERNAL_USER_EMAIL",
  role: "INTERNAL_USER_ROLE",
};

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_MISSING");
  }

  return databaseUrl;
}

function requireEnvironmentValue(name) {
  const value = process.env[name];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`ENVIRONMENT_VALUE_MISSING:${name}`);
  }

  return value;
}

function readInternalUserInput() {
  return {
    username: requireEnvironmentValue(ENVIRONMENT_FIELDS.username),
    password: requireEnvironmentValue(ENVIRONMENT_FIELDS.password),
    fullName: requireEnvironmentValue(ENVIRONMENT_FIELDS.fullName),
    email: requireEnvironmentValue(ENVIRONMENT_FIELDS.email),
    role: requireEnvironmentValue(ENVIRONMENT_FIELDS.role),
  };
}

function normalizeEmail(email) {
  return email.trim().toLocaleLowerCase("en-US");
}

function safeErrorCode(error) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "UNKNOWN";
  }

  return typeof error.code === "string" ? error.code : "UNKNOWN";
}

async function createInternalUser() {
  const input = readInternalUserInput();
  const validation = validateInternalUser(input);
  const normalizedUsername = normalizeUsername(input.username);

  if (!validation.valid || !normalizedUsername) {
    const firstError = validation.valid
      ? "El usuario no es válido."
      : validation.errors[validation.firstInvalidField];
    throw new Error(`INVALID_INTERNAL_USER_INPUT:${firstError}`);
  }

  const connection = await mysql.createConnection(requireDatabaseUrl());

  try {
    const [databaseRows] = await connection.query(
      "SELECT DATABASE() AS database_name",
    );

    if (!Array.isArray(databaseRows) || !databaseRows[0]?.database_name) {
      throw new Error("DATABASE_NOT_SELECTED");
    }

    const email = input.email.trim();
    const emailNormalized = normalizeEmail(email);

    const [existingRows] = await connection.execute(
      `SELECT username_normalized, email_normalized
       FROM internal_users
       WHERE username_normalized = ? OR email_normalized = ?
       LIMIT 1`,
      [normalizedUsername, emailNormalized],
    );
    const existing = existingRows[0];

    if (existing?.username_normalized === normalizedUsername) {
      throw new Error("INTERNAL_USERNAME_ALREADY_EXISTS");
    }

    if (existing?.email_normalized === emailNormalized) {
      throw new Error("INTERNAL_EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await hashPassword(input.password);

    await connection.execute(
      `INSERT INTO internal_users
        (id, username, username_normalized, full_name, email,
         email_normalized, password_hash, role, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        randomUUID(),
        input.username.trim(),
        normalizedUsername,
        input.fullName.trim(),
        email,
        emailNormalized,
        passwordHash,
        input.role,
      ],
    );

    console.log(
      `Usuario interno creado: ${normalizedUsername} (${input.role}).`,
    );
  } finally {
    await connection.end();
  }
}

createInternalUser().catch((error) => {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const code = safeErrorCode(error);

  if (message.startsWith("ENVIRONMENT_VALUE_MISSING:")) {
    console.error(`Falta la variable ${message.split(":")[1]}.`);
  } else if (message.startsWith("INVALID_INTERNAL_USER_INPUT:")) {
    console.error(message.slice("INVALID_INTERNAL_USER_INPUT:".length));
  } else if (message === "INTERNAL_USERNAME_ALREADY_EXISTS") {
    console.error("Ya existe un usuario interno con ese nombre de usuario.");
  } else if (message === "INTERNAL_EMAIL_ALREADY_EXISTS") {
    console.error("Ya existe un usuario interno con ese correo electrónico.");
  } else if (code === "ER_NO_SUCH_TABLE") {
    console.error(
      "La migración de acceso interno no está aplicada. Ejecuta npm run db:migrate.",
    );
  } else {
    console.error(`No se pudo crear el usuario interno (${code}).`);
  }

  process.exitCode = 1;
});
