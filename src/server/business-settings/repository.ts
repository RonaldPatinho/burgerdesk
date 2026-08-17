import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import {
  assertBusinessHoursDiffer,
  DEFAULT_BUSINESS_SETTINGS_STORE_ID,
  normalizeBusinessSettingsPatch,
  normalizeBusinessSettingsStoreId,
  type BusinessServiceStatus,
  type BusinessSettings,
  type BusinessSettingsUpdateInput,
} from "../../domain/business-settings";
import {
  getMySqlPool,
  withMySqlTransaction,
} from "../database/mysql";

interface BusinessSettingsRow extends RowDataPacket {
  store_id: string;
  business_name: string;
  opening_time: string;
  closing_time: string;
  service_status: BusinessServiceStatus;
  customer_message: string;
  digital_menu_enabled: number | boolean;
  online_payments_enabled: number | boolean;
  new_order_notifications_enabled: number | boolean;
  time_zone: string;
  updated_at: Date;
}

type BusinessSettingsExecutor = Pool | PoolConnection;

export class BusinessSettingsRepositoryError extends Error {
  constructor(
    public readonly code: "SETTINGS_NOT_FOUND" | "STALE_SETTINGS",
    message: string,
  ) {
    super(message);
    this.name = "BusinessSettingsRepositoryError";
  }
}

function databaseTime(value: string, field: string): string {
  const match = /^(\d{2}):(\d{2}):\d{2}$/.exec(value);
  if (!match) {
    throw new RangeError(`${field} no contiene un horario válido.`);
  }
  return `${match[1]}:${match[2]}`;
}

function mapBusinessSettings(row: BusinessSettingsRow): BusinessSettings {
  return {
    storeId: row.store_id,
    businessName: row.business_name,
    openingTime: databaseTime(row.opening_time, "opening_time"),
    closingTime: databaseTime(row.closing_time, "closing_time"),
    serviceStatus: row.service_status,
    customerMessage: row.customer_message,
    digitalMenuEnabled: Boolean(row.digital_menu_enabled),
    onlinePaymentsEnabled: Boolean(row.online_payments_enabled),
    newOrderNotificationsEnabled: Boolean(
      row.new_order_notifications_enabled,
    ),
    timeZone: row.time_zone,
    updatedAt: row.updated_at.toISOString(),
  };
}

async function readBusinessSettings(
  executor: BusinessSettingsExecutor,
  storeId: string,
  lock = false,
): Promise<BusinessSettings | null> {
  const [rows] = await executor.execute<BusinessSettingsRow[]>(
    `SELECT
       store_id,
       business_name,
       TIME_FORMAT(opening_time, '%H:%i:%s') AS opening_time,
       TIME_FORMAT(closing_time, '%H:%i:%s') AS closing_time,
       service_status,
       customer_message,
       digital_menu_enabled,
       online_payments_enabled,
       new_order_notifications_enabled,
       time_zone,
       updated_at
     FROM business_settings
     WHERE store_id = ?
     LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [storeId],
  );
  return rows[0] ? mapBusinessSettings(rows[0]) : null;
}

export async function getBusinessSettings(
  storeId: string = DEFAULT_BUSINESS_SETTINGS_STORE_ID,
): Promise<BusinessSettings | null> {
  return readBusinessSettings(
    getMySqlPool(),
    normalizeBusinessSettingsStoreId(storeId),
  );
}

export async function updateBusinessSettings(
  input: BusinessSettingsUpdateInput,
): Promise<BusinessSettings> {
  const storeId = normalizeBusinessSettingsStoreId(input.storeId);
  const patch = normalizeBusinessSettingsPatch(input.patch);
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    throw new RangeError("La versión de la configuración no es válida.");
  }

  return withMySqlTransaction(async (connection) => {
    const current = await readBusinessSettings(connection, storeId, true);
    if (!current) {
      throw new BusinessSettingsRepositoryError(
        "SETTINGS_NOT_FOUND",
        "No encontramos la configuración del local.",
      );
    }
    if (current.updatedAt !== expectedUpdatedAt.toISOString()) {
      throw new BusinessSettingsRepositoryError(
        "STALE_SETTINGS",
        "La configuración cambió. Actualiza los datos antes de guardar.",
      );
    }

    const openingTime = patch.openingTime ?? current.openingTime;
    const closingTime = patch.closingTime ?? current.closingTime;
    assertBusinessHoursDiffer(openingTime, closingTime);

    const columnByField = {
      businessName: "business_name",
      openingTime: "opening_time",
      closingTime: "closing_time",
      serviceStatus: "service_status",
      customerMessage: "customer_message",
      digitalMenuEnabled: "digital_menu_enabled",
      onlinePaymentsEnabled: "online_payments_enabled",
      newOrderNotificationsEnabled: "new_order_notifications_enabled",
      timeZone: "time_zone",
    } as const;
    const assignments: string[] = [];
    const values: Array<string | boolean> = [];
    for (const field of Object.keys(columnByField) as Array<
      keyof typeof columnByField
    >) {
      const value = patch[field];
      if (value !== undefined) {
        assignments.push(`${columnByField[field]} = ?`);
        values.push(value);
      }
    }
    assignments.push(
      "updated_at = GREATEST(CURRENT_TIMESTAMP(3), TIMESTAMPADD(MICROSECOND, 1000, updated_at))",
    );
    values.push(storeId);
    await connection.execute<ResultSetHeader>(
      `UPDATE business_settings
       SET ${assignments.join(", ")}
       WHERE store_id = ?`,
      values,
    );

    const updated = await readBusinessSettings(connection, storeId);
    if (!updated) {
      throw new BusinessSettingsRepositoryError(
        "SETTINGS_NOT_FOUND",
        "No encontramos la configuración actualizada del local.",
      );
    }
    return updated;
  });
}
