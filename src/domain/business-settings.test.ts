import assert from "node:assert/strict";
import test from "node:test";
import {
  BusinessSettingsValidationError,
  normalizeBusinessSettingsPatch,
  normalizeBusinessSettingsUpdateRequest,
} from "./business-settings";

test("normaliza todos los campos editables de la configuración", () => {
  const patch = normalizeBusinessSettingsPatch({
    businessName: "  BurgerDesk Centro  ",
    openingTime: "08:30",
    closingTime: "22:15",
    serviceStatus: "closed",
    customerMessage: "  Volvemos pronto.  ",
    digitalMenuEnabled: false,
    onlinePaymentsEnabled: true,
    newOrderNotificationsEnabled: false,
    timeZone: "America/Caracas",
  });

  assert.deepEqual(patch, {
    businessName: "BurgerDesk Centro",
    openingTime: "08:30",
    closingTime: "22:15",
    serviceStatus: "closed",
    customerMessage: "Volvemos pronto.",
    digitalMenuEnabled: false,
    onlinePaymentsEnabled: true,
    newOrderNotificationsEnabled: false,
    timeZone: "America/Caracas",
  });
});

test("rechaza horarios, valores, booleanos, textos y campos ajenos", () => {
  const invalidPatches = [
    { openingTime: "24:00" },
    { openingTime: "08:00", closingTime: "08:00" },
    { serviceStatus: "paused" },
    { digitalMenuEnabled: 1 },
    { businessName: " " },
    { customerMessage: "x".repeat(501) },
    { timeZone: "Mars/Olympus" },
    { stripeSecret: "no-permitido" },
    {},
  ];

  for (const patch of invalidPatches) {
    assert.throws(
      () => normalizeBusinessSettingsPatch(patch),
      BusinessSettingsValidationError,
    );
  }
});

test("valida la versión esperada y la estructura de actualización", () => {
  const normalized = normalizeBusinessSettingsUpdateRequest({
    expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
    patch: { customerMessage: "" },
  });
  assert.equal(normalized.expectedUpdatedAt, "2026-08-16T12:00:00.000Z");
  assert.deepEqual(normalized.patch, { customerMessage: "" });

  assert.throws(
    () =>
      normalizeBusinessSettingsUpdateRequest({
        expectedUpdatedAt: "no-es-fecha",
        patch: { serviceStatus: "open" },
      }),
    BusinessSettingsValidationError,
  );
});
