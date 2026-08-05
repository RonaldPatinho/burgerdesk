export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const acceptedAvatarMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AcceptedAvatarMimeType = (typeof acceptedAvatarMimeTypes)[number];

export interface ClientProfileView {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  preferredStoreId: string;
  preferredStoreName: string;
  contactWhatsapp: boolean;
  contactEmail: boolean;
  hasAvatar: boolean;
  updatedAt: string;
}

export interface ClientProfileStatsView {
  orderCount: number;
  favoriteCount: number;
  totalPaidCop: number;
}

export type ClientOrderDisplayStatus =
  | "pending"
  | "confirmed"
  | "expired"
  | "failed";

export interface ClientOrderSummaryView {
  id: string;
  code: string;
  createdAt: string;
  status: ClientOrderDisplayStatus;
  statusLabel: string;
  productSummary: string;
  totalCop: number;
}

export interface ClientOrderDetailView extends ClientOrderSummaryView {
  paymentMethod: "stripe" | "efectivo";
  paymentMethodLabel: string;
  storeId: string;
  storeName: string;
  subtotalCop: number;
  serviceFeeCop: number;
  confirmedAt: string | null;
  lines: readonly {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitBasePriceCop: number;
    lineTotalCop: number;
    options: readonly {
      optionId: string;
      optionName: string;
      priceCop: number;
    }[];
  }[];
}

export interface ClientProfileDashboard {
  profile: ClientProfileView;
  stats: ClientProfileStatsView;
  recentOrders: readonly ClientOrderSummaryView[];
  totalOrderCount: number;
}

export interface ClientProfileUpdateInput {
  fullName: string;
  email: string;
  phone: string;
  preferredStoreId: string;
  contactWhatsapp: boolean;
  contactEmail: boolean;
}

export type ClientProfileField =
  | "fullName"
  | "email"
  | "phone"
  | "preferredStoreId"
  | "avatar";

export type ClientProfileFieldErrors = Partial<
  Record<ClientProfileField, string>
>;

export class ClientProfileValidationError extends Error {
  constructor(public readonly errors: ClientProfileFieldErrors) {
    super("Los datos del perfil no son válidos.");
    this.name = "ClientProfileValidationError";
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9 ()-]{6,30}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

export function parseClientProfileUpdate(
  value: unknown,
  validStoreIds: readonly string[],
): ClientProfileUpdateInput {
  const errors: ClientProfileFieldErrors = {};
  const record = isRecord(value) ? value : {};
  const fullName = typeof record.fullName === "string" ? record.fullName.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const phone = typeof record.phone === "string" ? record.phone.trim() : "";
  const preferredStoreId =
    typeof record.preferredStoreId === "string"
      ? record.preferredStoreId.trim()
      : "";

  if (fullName.length < 2 || fullName.length > 120) {
    errors.fullName = "Escribe un nombre de 2 a 120 caracteres.";
  }
  if (!emailPattern.test(email) || email.length > 254) {
    errors.email = "Usa un correo electrónico válido.";
  }
  if (!phonePattern.test(phone) || phone.length > 32) {
    errors.phone = "Usa un teléfono válido de 7 a 32 caracteres.";
  }
  if (!validStoreIds.includes(preferredStoreId)) {
    errors.preferredStoreId = "Selecciona una sede disponible.";
  }
  if (
    typeof record.contactWhatsapp !== "boolean" ||
    typeof record.contactEmail !== "boolean"
  ) {
    throw new ClientProfileValidationError({
      ...errors,
      preferredStoreId:
        errors.preferredStoreId ?? "Revisa las preferencias de contacto.",
    });
  }
  if (Object.keys(errors).length > 0) {
    throw new ClientProfileValidationError(errors);
  }

  return {
    fullName,
    email,
    phone,
    preferredStoreId,
    contactWhatsapp: record.contactWhatsapp,
    contactEmail: record.contactEmail,
  };
}

export function validateAvatarFile(file: File): AcceptedAvatarMimeType {
  if (!acceptedAvatarMimeTypes.includes(file.type as AcceptedAvatarMimeType)) {
    throw new ClientProfileValidationError({
      avatar: "Usa una imagen JPEG, PNG o WebP.",
    });
  }
  if (file.size < 1 || file.size > MAX_AVATAR_BYTES) {
    throw new ClientProfileValidationError({
      avatar: "La fotografía debe pesar como máximo 5 MB.",
    });
  }
  return file.type as AcceptedAvatarMimeType;
}
