import type { BusinessSettings } from "../../domain/business-settings";

export type CustomerCheckoutPaymentMethod = "stripe" | "efectivo";

export class BusinessOperationsError extends Error {
  constructor(
    public readonly code:
      | "SETTINGS_UNAVAILABLE"
      | "DIGITAL_MENU_DISABLED"
      | "SERVICE_CLOSED"
      | "ONLINE_PAYMENTS_DISABLED",
    message: string,
  ) {
    super(message);
    this.name = "BusinessOperationsError";
  }
}

export function assertCustomerCheckoutAllowed(
  settings: BusinessSettings | null,
  paymentMethod: CustomerCheckoutPaymentMethod,
): void {
  if (!settings) {
    throw new BusinessOperationsError(
      "SETTINGS_UNAVAILABLE",
      "No pudimos confirmar la disponibilidad del local. Intenta nuevamente.",
    );
  }
  if (!settings.digitalMenuEnabled) {
    throw new BusinessOperationsError(
      "DIGITAL_MENU_DISABLED",
      "El menú digital no está disponible en este momento.",
    );
  }
  if (settings.serviceStatus === "closed") {
    throw new BusinessOperationsError(
      "SERVICE_CLOSED",
      "El local no está recibiendo pedidos en este momento.",
    );
  }
  if (paymentMethod === "stripe" && !settings.onlinePaymentsEnabled) {
    throw new BusinessOperationsError(
      "ONLINE_PAYMENTS_DISABLED",
      "El pago en línea no está disponible. Puedes pagar en efectivo.",
    );
  }
}

export function customerCatalogIsAvailable(
  settings: BusinessSettings | null,
): settings is BusinessSettings {
  return settings?.digitalMenuEnabled === true;
}

export function staffAutomaticRefreshIsEnabled(
  settings: BusinessSettings | null,
): boolean {
  return settings?.newOrderNotificationsEnabled === true;
}
