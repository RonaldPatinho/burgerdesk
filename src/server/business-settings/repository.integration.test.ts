import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { BusinessSettingsValidationError } from "../../domain/business-settings";
import { closeMySqlPool, getMySqlPool } from "../database/mysql";
import {
  BusinessSettingsRepositoryError,
  getBusinessSettings,
  updateBusinessSettings,
} from "./repository";

const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const readStoreId = `settings-read-${runId}`;
const updateStoreId = `settings-update-${runId}`;
const hoursStoreId = `settings-hours-${runId}`;
const storeIds = [readStoreId, updateStoreId, hoursStoreId];

before(async () => {
  const pool = getMySqlPool();
  for (const storeId of storeIds) {
    await pool.execute(
      `INSERT INTO business_settings (
         store_id, business_name, opening_time, closing_time,
         service_status, customer_message, digital_menu_enabled,
         online_payments_enabled, new_order_notifications_enabled,
         time_zone, updated_at
       ) VALUES (?, 'BurgerDesk Prueba', '08:00:00', '18:00:00',
         'open', 'Mensaje inicial', TRUE, TRUE, TRUE,
         'America/Caracas', '2026-01-01 00:00:00.000')`,
      [storeId],
    );
  }
});

after(async () => {
  await getMySqlPool().execute(
    "DELETE FROM business_settings WHERE store_id IN (?, ?, ?)",
    storeIds,
  );
  await closeMySqlPool();
});

test("lee la configuración persistida por store_id", async () => {
  const settings = await getBusinessSettings(readStoreId);
  assert.ok(settings);
  assert.equal(settings.businessName, "BurgerDesk Prueba");
  assert.equal(settings.openingTime, "08:00");
  assert.equal(settings.closingTime, "18:00");
  assert.equal(settings.serviceStatus, "open");
  assert.equal(settings.timeZone, "America/Caracas");
  assert.equal(settings.digitalMenuEnabled, true);
});

test("actualiza parcialmente y rechaza una versión obsoleta", async () => {
  const initial = await getBusinessSettings(updateStoreId);
  assert.ok(initial);
  const updated = await updateBusinessSettings({
    storeId: updateStoreId,
    expectedUpdatedAt: initial.updatedAt,
    patch: {
      businessName: "BurgerDesk Actualizado",
      closingTime: "21:30",
      serviceStatus: "closed",
      customerMessage: "Cerrado por hoy.",
      onlinePaymentsEnabled: false,
      timeZone: "America/Bogota",
    },
  });

  assert.equal(updated.businessName, "BurgerDesk Actualizado");
  assert.equal(updated.openingTime, "08:00");
  assert.equal(updated.closingTime, "21:30");
  assert.equal(updated.serviceStatus, "closed");
  assert.equal(updated.onlinePaymentsEnabled, false);
  assert.equal(updated.digitalMenuEnabled, true);
  assert.equal(updated.timeZone, "America/Bogota");
  assert.notEqual(updated.updatedAt, initial.updatedAt);

  await assert.rejects(
    updateBusinessSettings({
      storeId: updateStoreId,
      expectedUpdatedAt: initial.updatedAt,
      patch: { customerMessage: "Versión obsoleta" },
    }),
    (error: unknown) =>
      error instanceof BusinessSettingsRepositoryError &&
      error.code === "STALE_SETTINGS",
  );
});

test("valida el horario combinado incluso en actualizaciones parciales", async () => {
  const initial = await getBusinessSettings(hoursStoreId);
  assert.ok(initial);
  await assert.rejects(
    updateBusinessSettings({
      storeId: hoursStoreId,
      expectedUpdatedAt: initial.updatedAt,
      patch: { closingTime: initial.openingTime },
    }),
    BusinessSettingsValidationError,
  );
});
