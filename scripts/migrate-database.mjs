import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const migrationLockName = "burgerdesk:migrations";
const migrationsDirectory = resolve("database", "migrations");

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_MISSING");
  }

  return databaseUrl;
}

function safeErrorCode(error) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "UNKNOWN";
  }

  return typeof error.code === "string" ? error.code : "UNKNOWN";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeMigrationSql(sql) {
  return sql.replace(/\r\n?/g, "\n");
}

function migrationChecksums(sql) {
  return {
    raw: sha256(sql),
    canonical: sha256(normalizeMigrationSql(sql)),
  };
}

async function migrate() {
  const connection = await mysql.createConnection(requireDatabaseUrl());
  let lockAcquired = false;

  try {
    const [databaseRows] = await connection.query("SELECT DATABASE() AS database_name");
    if (!Array.isArray(databaseRows) || !databaseRows[0]?.database_name) {
      throw new Error("DATABASE_NOT_SELECTED");
    }

    const [lockRows] = await connection.execute(
      "SELECT GET_LOCK(?, 30) AS acquired",
      [migrationLockName],
    );
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) {
      throw new Error("MIGRATION_LOCK_TIMEOUT");
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        checksum_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (migration_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((fileName) => /^\d{3}_[a-z0-9_]+\.sql$/.test(fileName))
      .sort();

    for (const migrationFile of migrationFiles) {
      const sql = await readFile(resolve(migrationsDirectory, migrationFile), "utf8");
      const checksums = migrationChecksums(sql);
      const [existingRows] = await connection.execute(
        "SELECT checksum_sha256 FROM schema_migrations WHERE migration_name = ?",
        [migrationFile],
      );
      const existing = existingRows[0];

      if (existing) {
        const checksumMatches =
          existing.checksum_sha256 === checksums.raw ||
          existing.checksum_sha256 === checksums.canonical;

        if (!checksumMatches) {
          throw new Error("MIGRATION_CHECKSUM_MISMATCH");
        }

        console.log(`Migración ya aplicada: ${migrationFile}`);
        continue;
      }

      const statements = sql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await connection.query(statement);
      }

      await connection.execute(
        "INSERT INTO schema_migrations (migration_name, checksum_sha256) VALUES (?, ?)",
        [migrationFile, checksums.canonical],
      );
      console.log(`Migración aplicada: ${migrationFile}`);
    }

    console.log("Conexión MySQL verificada y migraciones al día.");
  } finally {
    if (lockAcquired) {
      await connection.execute("SELECT RELEASE_LOCK(?)", [migrationLockName]);
    }
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error(`No se pudieron aplicar las migraciones (${safeErrorCode(error)}).`);
  process.exitCode = 1;
});
