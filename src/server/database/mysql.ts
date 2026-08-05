import mysql, {
  type Pool,
  type PoolConnection,
} from "mysql2/promise";

const globalDatabase = globalThis as typeof globalThis & {
  burgerDeskMySqlPool?: Pool;
};

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("La persistencia del servidor no esta configurada.");
    this.name = "DatabaseConfigurationError";
  }
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new DatabaseConfigurationError();
  }

  return databaseUrl;
}

export function getMySqlPool(): Pool {
  if (!globalDatabase.burgerDeskMySqlPool) {
    globalDatabase.burgerDeskMySqlPool = mysql.createPool({
      uri: requireDatabaseUrl(),
      connectionLimit: 10,
      enableKeepAlive: true,
      maxIdle: 10,
      idleTimeout: 60_000,
      queueLimit: 0,
      supportBigNumbers: true,
      bigNumberStrings: false,
      timezone: "Z",
    });
  }

  return globalDatabase.burgerDeskMySqlPool;
}

export async function closeMySqlPool(): Promise<void> {
  const pool = globalDatabase.burgerDeskMySqlPool;
  if (!pool) {
    return;
  }

  delete globalDatabase.burgerDeskMySqlPool;
  await pool.end();
}

export async function withMySqlTransaction<T>(
  operation: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getMySqlPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function hasMySqlErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === expectedCode
  );
}
