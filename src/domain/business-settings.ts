import { ADMINISTRATOR_DEFAULT_STORE_ID } from "./admin-finance";

export const DEFAULT_BUSINESS_SETTINGS_STORE_ID =
  ADMINISTRATOR_DEFAULT_STORE_ID;

export const businessServiceStatuses = ["open", "closed"] as const;
export type BusinessServiceStatus =
  (typeof businessServiceStatuses)[number];

export interface BusinessSettings {
  storeId: string;
  businessName: string;
  openingTime: string;
  closingTime: string;
  serviceStatus: BusinessServiceStatus;
  customerMessage: string;
  digitalMenuEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  newOrderNotificationsEnabled: boolean;
  timeZone: string;
  updatedAt: string;
}

export interface BusinessSettingsPatch {
  businessName?: string;
  openingTime?: string;
  closingTime?: string;
  serviceStatus?: BusinessServiceStatus;
  customerMessage?: string;
  digitalMenuEnabled?: boolean;
  onlinePaymentsEnabled?: boolean;
  newOrderNotificationsEnabled?: boolean;
  timeZone?: string;
}

export interface BusinessSettingsUpdateInput {
  storeId: string;
  expectedUpdatedAt: string;
  patch: BusinessSettingsPatch;
}

export class BusinessSettingsValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "BusinessSettingsValidationError";
  }
}

const editableFields = new Set([
  "businessName",
  "openingTime",
  "closingTime",
  "serviceStatus",
  "customerMessage",
  "digitalMenuEnabled",
  "onlinePaymentsEnabled",
  "newOrderNotificationsEnabled",
  "timeZone",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeBusinessSettingsStoreId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value)
  ) {
    throw new BusinessSettingsValidationError(
      "storeId",
      "El identificador del local no es válido.",
    );
  }
  return value;
}

function normalizeTime(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  ) {
    throw new BusinessSettingsValidationError(
      field,
      "Usa un horario válido en formato HH:mm.",
    );
  }
  return value;
}

function normalizeBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new BusinessSettingsValidationError(
      field,
      "La opción debe ser verdadera o falsa.",
    );
  }
  return value;
}

function normalizeTimeZone(value: unknown): string {
  if (typeof value !== "string") {
    throw new BusinessSettingsValidationError(
      "timeZone",
      "La zona horaria no es válida.",
    );
  }
  const timeZone = value.trim();
  if (timeZone.length < 1 || timeZone.length > 64) {
    throw new BusinessSettingsValidationError(
      "timeZone",
      "La zona horaria debe tener entre 1 y 64 caracteres.",
    );
  }
  try {
    new Intl.DateTimeFormat("es-CO", { timeZone }).format(new Date(0));
  } catch {
    throw new BusinessSettingsValidationError(
      "timeZone",
      "La zona horaria no está permitida.",
    );
  }
  return timeZone;
}

export function assertBusinessHoursDiffer(
  openingTime: string,
  closingTime: string,
): void {
  if (openingTime === closingTime) {
    throw new BusinessSettingsValidationError(
      "closingTime",
      "La hora de cierre debe ser distinta de la hora de apertura.",
    );
  }
}

export function normalizeBusinessSettingsPatch(
  value: unknown,
): BusinessSettingsPatch {
  if (!isRecord(value)) {
    throw new BusinessSettingsValidationError(
      "patch",
      "Los cambios de configuración no son válidos.",
    );
  }
  const unexpectedField = Object.keys(value).find(
    (field) => !editableFields.has(field),
  );
  if (unexpectedField) {
    throw new BusinessSettingsValidationError(
      unexpectedField,
      "El campo no forma parte de la configuración editable.",
    );
  }

  const patch: BusinessSettingsPatch = {};
  if (value.businessName !== undefined) {
    if (typeof value.businessName !== "string") {
      throw new BusinessSettingsValidationError(
        "businessName",
        "El nombre del negocio no es válido.",
      );
    }
    const businessName = value.businessName.trim();
    if (businessName.length < 2 || businessName.length > 120) {
      throw new BusinessSettingsValidationError(
        "businessName",
        "El nombre debe tener entre 2 y 120 caracteres.",
      );
    }
    patch.businessName = businessName;
  }
  if (value.openingTime !== undefined) {
    patch.openingTime = normalizeTime(value.openingTime, "openingTime");
  }
  if (value.closingTime !== undefined) {
    patch.closingTime = normalizeTime(value.closingTime, "closingTime");
  }
  if (
    patch.openingTime !== undefined &&
    patch.closingTime !== undefined
  ) {
    assertBusinessHoursDiffer(patch.openingTime, patch.closingTime);
  }
  if (value.serviceStatus !== undefined) {
    if (
      typeof value.serviceStatus !== "string" ||
      !businessServiceStatuses.some(
        (status) => status === value.serviceStatus,
      )
    ) {
      throw new BusinessSettingsValidationError(
        "serviceStatus",
        "El estado del servicio no está permitido.",
      );
    }
    patch.serviceStatus = value.serviceStatus as BusinessServiceStatus;
  }
  if (value.customerMessage !== undefined) {
    if (typeof value.customerMessage !== "string") {
      throw new BusinessSettingsValidationError(
        "customerMessage",
        "El mensaje para clientes no es válido.",
      );
    }
    const customerMessage = value.customerMessage.trim();
    if (customerMessage.length > 500) {
      throw new BusinessSettingsValidationError(
        "customerMessage",
        "El mensaje debe tener como máximo 500 caracteres.",
      );
    }
    patch.customerMessage = customerMessage;
  }
  if (value.digitalMenuEnabled !== undefined) {
    patch.digitalMenuEnabled = normalizeBoolean(
      value.digitalMenuEnabled,
      "digitalMenuEnabled",
    );
  }
  if (value.onlinePaymentsEnabled !== undefined) {
    patch.onlinePaymentsEnabled = normalizeBoolean(
      value.onlinePaymentsEnabled,
      "onlinePaymentsEnabled",
    );
  }
  if (value.newOrderNotificationsEnabled !== undefined) {
    patch.newOrderNotificationsEnabled = normalizeBoolean(
      value.newOrderNotificationsEnabled,
      "newOrderNotificationsEnabled",
    );
  }
  if (value.timeZone !== undefined) {
    patch.timeZone = normalizeTimeZone(value.timeZone);
  }
  if (Object.keys(patch).length === 0) {
    throw new BusinessSettingsValidationError(
      "patch",
      "Debes indicar al menos un cambio de configuración.",
    );
  }
  return patch;
}

export function normalizeBusinessSettingsUpdateRequest(value: unknown): {
  expectedUpdatedAt: string;
  patch: BusinessSettingsPatch;
} {
  if (!isRecord(value)) {
    throw new BusinessSettingsValidationError(
      "settings",
      "La solicitud de configuración no es válida.",
    );
  }
  const unexpectedField = Object.keys(value).find(
    (field) => field !== "expectedUpdatedAt" && field !== "patch",
  );
  if (unexpectedField) {
    throw new BusinessSettingsValidationError(
      unexpectedField,
      "El campo no forma parte de la solicitud.",
    );
  }
  if (
    typeof value.expectedUpdatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.expectedUpdatedAt))
  ) {
    throw new BusinessSettingsValidationError(
      "expectedUpdatedAt",
      "La versión de la configuración no es válida.",
    );
  }
  return {
    expectedUpdatedAt: new Date(value.expectedUpdatedAt).toISOString(),
    patch: normalizeBusinessSettingsPatch(value.patch),
  };
}
