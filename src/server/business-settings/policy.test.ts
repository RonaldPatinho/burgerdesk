import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessSettings } from "../../domain/business-settings";
import {
  assertCustomerCheckoutAllowed,
  BusinessOperationsError,
  customerCatalogIsAvailable,
  staffAutomaticRefreshIsEnabled,
} from "./policy";

function settings(
  patch: Partial<BusinessSettings> = {},
): BusinessSettings {
  return {
    storeId: "sede-centro",
    businessName: "BurgerDesk",
    openingTime: "11:30",
    closingTime: "22:00",
    serviceStatus: "open",
    customerMessage: "Tu pedido estará listo pronto.",
    digitalMenuEnabled: true,
    onlinePaymentsEnabled: true,
    newOrderNotificationsEnabled: true,
    timeZone: "America/Caracas",
    updatedAt: "2026-08-16T12:00:00.000Z",
    ...patch,
  };
}

function operationCode(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error: unknown) {
    assert.ok(error instanceof BusinessOperationsError);
    return error.code;
  }
}

test("bloquea checkout si la configuración falta, el menú está inactivo o el local cerró", () => {
  assert.equal(
    operationCode(() => assertCustomerCheckoutAllowed(null, "efectivo")),
    "SETTINGS_UNAVAILABLE",
  );
  assert.equal(
    operationCode(() =>
      assertCustomerCheckoutAllowed(
        settings({ digitalMenuEnabled: false }),
        "efectivo",
      ),
    ),
    "DIGITAL_MENU_DISABLED",
  );
  assert.equal(
    operationCode(() =>
      assertCustomerCheckoutAllowed(
        settings({ serviceStatus: "closed" }),
        "efectivo",
      ),
    ),
    "SERVICE_CLOSED",
  );
});

test("desactivar pagos en línea rechaza Stripe pero conserva efectivo", () => {
  const cashOnly = settings({ onlinePaymentsEnabled: false });
  assert.equal(
    operationCode(() => assertCustomerCheckoutAllowed(cashOnly, "stripe")),
    "ONLINE_PAYMENTS_DISABLED",
  );
  assert.doesNotThrow(() =>
    assertCustomerCheckoutAllowed(cashOnly, "efectivo"),
  );
});

test("menú público y sondeo de Personal respetan sus preferencias con fallback seguro", () => {
  assert.equal(customerCatalogIsAvailable(settings()), true);
  assert.equal(customerCatalogIsAvailable(settings({ digitalMenuEnabled: false })), false);
  assert.equal(customerCatalogIsAvailable(null), false);
  assert.equal(staffAutomaticRefreshIsEnabled(settings()), true);
  assert.equal(
    staffAutomaticRefreshIsEnabled(
      settings({ newOrderNotificationsEnabled: false }),
    ),
    false,
  );
  assert.equal(staffAutomaticRefreshIsEnabled(null), false);
});
