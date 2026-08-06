import mysql from "mysql2/promise";

const requiredMigrations = [
  "001_create_order_persistence.sql",
  "002_create_client_profiles.sql",
  "003_create_internal_access.sql",
  "004_add_operational_order_status.sql",
];

const requiredTables = [
  "schema_migrations",
  "orders",
  "order_lines",
  "order_line_options",
  "payment_attempts",
  "stripe_webhook_events",
  "client_users",
  "client_sessions",
  "client_avatars",
  "internal_users",
  "internal_sessions",
  "staff_shifts",
  "internal_access_events",
  "order_status_history",
];

const requiredUniqueIndexes = [
  "uq_orders_creation_idempotency",
  "uq_payment_attempts_order_number",
  "uq_payment_attempts_request_idempotency",
  "uq_payment_attempts_checkout_session",
  "uq_payment_attempts_payment_intent",
  "uq_client_users_email_normalized",
  "uq_client_sessions_token_hash",
  "uq_internal_users_username_normalized",
  "uq_internal_users_email_normalized",
  "uq_internal_sessions_token_hash",
  "uq_order_status_history_order_status",
];

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_MISSING");
  }

  return databaseUrl;
}

async function checkDatabase() {
  const connection = await mysql.createConnection(requireDatabaseUrl());

  try {
    const [databaseRows] = await connection.query("SELECT DATABASE() AS database_name");
    const [engineRows] = await connection.execute(
      "SELECT SUPPORT FROM information_schema.ENGINES WHERE ENGINE = 'InnoDB'",
    );
    const [migrationRows] = await connection.execute(
      "SELECT COUNT(*) AS migration_count FROM schema_migrations",
    );
    const migrationPlaceholders = requiredMigrations.map(() => "?").join(", ");
    const [requiredMigrationRows] = await connection.execute(
      `SELECT migration_name
       FROM schema_migrations
       WHERE migration_name IN (${migrationPlaceholders})`,
      requiredMigrations,
    );
    const tablePlaceholders = requiredTables.map(() => "?").join(", ");
    const [tableRows] = await connection.execute(
      `SELECT TABLE_NAME, ENGINE
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (${tablePlaceholders})`,
      requiredTables,
    );
    const indexPlaceholders = requiredUniqueIndexes.map(() => "?").join(", ");
    const [indexRows] = await connection.execute(
      `SELECT DISTINCT INDEX_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND NON_UNIQUE = 0
         AND INDEX_NAME IN (${indexPlaceholders})`,
      requiredUniqueIndexes,
    );

    if (!databaseRows[0]?.database_name) {
      throw new Error("DATABASE_NOT_SELECTED");
    }

    if (!engineRows[0] || !["YES", "DEFAULT"].includes(engineRows[0].SUPPORT)) {
      throw new Error("INNODB_NOT_AVAILABLE");
    }

    if (Number(migrationRows[0]?.migration_count) < requiredMigrations.length) {
      throw new Error("MIGRATIONS_NOT_APPLIED");
    }

    if (requiredMigrationRows.length !== requiredMigrations.length) {
      throw new Error("REQUIRED_MIGRATIONS_MISSING");
    }

    if (
      tableRows.length !== requiredTables.length ||
      tableRows.some((row) => row.ENGINE !== "InnoDB")
    ) {
      throw new Error("REQUIRED_INNODB_TABLES_MISSING");
    }

    if (indexRows.length !== requiredUniqueIndexes.length) {
      throw new Error("REQUIRED_UNIQUE_INDEXES_MISSING");
    }

    console.log(
      "Conexión MySQL, InnoDB, migraciones, tablas e índices verificados.",
    );
  } finally {
    await connection.end();
  }
}

checkDatabase().catch(() => {
  console.error("No se pudo verificar la persistencia MySQL.");
  process.exitCode = 1;
});
