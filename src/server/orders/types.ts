export const serverPaymentMethods = ["stripe", "efectivo"] as const;
export type ServerPaymentMethod = (typeof serverPaymentMethods)[number];

export const internalOrderStatuses = [
  "pendiente_de_pago",
  "confirmado",
] as const;
export type InternalOrderStatus = (typeof internalOrderStatuses)[number];

export const internalPaymentStatuses = [
  "pendiente",
  "pendiente_en_efectivo",
  "pagado",
  "expirado",
  "fallido",
] as const;
export type InternalPaymentStatus = (typeof internalPaymentStatuses)[number];

export const paymentAttemptStatuses = [
  "pendiente",
  "pagado",
  "expirado",
  "fallido",
] as const;
export type PaymentAttemptStatus = (typeof paymentAttemptStatuses)[number];

export interface RecalculatedOrderOptionDraft {
  optionId: string;
  optionName: string;
  priceCop: number;
}

export interface RecalculatedOrderLineDraft {
  productId: string;
  productName: string;
  quantity: number;
  unitBasePriceCop: number;
  unitPriceCop: number;
  lineTotalCop: number;
  options: readonly RecalculatedOrderOptionDraft[];
}

interface RecalculatedOrderDraftBase {
  creationIdempotencyKey: string;
  clientSessionId: string;
  clientId: string | null;
  storeId: string;
  kitchenNote: string;
  subtotalCop: number;
  serviceFeeCop: number;
  totalCop: number;
  lines: readonly RecalculatedOrderLineDraft[];
}

export type RecalculatedOrderDraft = RecalculatedOrderDraftBase &
  (
    | {
        paymentMethod: "stripe";
        paymentRequestIdempotencyKey: string;
      }
    | {
        paymentMethod: "efectivo";
      }
  );

export interface PersistedOrderOption {
  id: string;
  optionId: string;
  optionName: string;
  priceCop: number;
}

export interface PersistedOrderLine {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitBasePriceCop: number;
  unitPriceCop: number;
  lineTotalCop: number;
  options: readonly PersistedOrderOption[];
}

export interface PaymentAttemptRecord {
  id: string;
  orderId: string;
  attemptNumber: number;
  status: PaymentAttemptStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedOrder {
  id: string;
  clientSessionId: string;
  clientId: string | null;
  storeId: string;
  paymentMethod: ServerPaymentMethod;
  orderStatus: InternalOrderStatus;
  paymentStatus: InternalPaymentStatus;
  currency: "COP";
  subtotalCop: number;
  serviceFeeCop: number;
  totalCop: number;
  kitchenNote: string;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: readonly PersistedOrderLine[];
  paymentAttempts: readonly PaymentAttemptRecord[];
}

export interface CreatedInternalOrder {
  order: PersistedOrder;
  paymentAttempt: PaymentAttemptRecord | null;
  reused: boolean;
}

export interface StripeWebhookSessionData {
  id: string;
  mode: string | null;
  paymentStatus: string | null;
  amountTotalMinor: number | null;
  currency: string | null;
  clientReferenceId: string | null;
  metadataOrderId: string | null;
  metadataPaymentAttemptId: string | null;
  paymentIntentId: string | null;
}

export interface StripeWebhookEventData {
  eventId: string;
  eventType: string;
  eventCreatedAt: Date;
  session: StripeWebhookSessionData | null;
}

export interface StripeWebhookProcessingResult {
  duplicate: boolean;
  outcome: "procesado" | "ignorado";
  orderId: string | null;
}
