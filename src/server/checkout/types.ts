import type {
  Cart,
  OrderStatus,
  ProductId,
  ProductOptionId,
} from "../../domain/models";
import type {
  CreatedInternalOrder,
  PaymentAttemptRecord,
  PersistedOrder,
  RecalculatedOrderDraft,
} from "../orders/types";

export type CheckoutPaymentMethod = "stripe" | "efectivo";

export interface CheckoutCartItemInput {
  productId: ProductId;
  optionIds: readonly ProductOptionId[];
  quantity: number;
}

export interface CheckoutRequestInput {
  requestId: string;
  paymentMethod: CheckoutPaymentMethod;
  termsAccepted: true;
  clientSession: {
    sessionId: string;
    clientId: string | null;
  };
  cart: {
    items: readonly CheckoutCartItemInput[];
    kitchenNote: string;
  };
  retryOrderId: string | null;
}

export interface CanonicalCheckout {
  cart: Cart;
  draft: RecalculatedOrderDraft;
}

export interface CheckoutOrderPersistence {
  createOrder(
    draft: RecalculatedOrderDraft,
  ): Promise<CreatedInternalOrder>;
  getOrderById(orderId: string): Promise<PersistedOrder | null>;
  getOrderByCheckoutSessionId(
    checkoutSessionId: string,
  ): Promise<PersistedOrder | null>;
  createRetryPaymentAttempt(
    orderId: string,
    requestIdempotencyKey: string,
  ): Promise<{ attempt: PaymentAttemptRecord; reused: boolean }>;
  attachCheckoutSession(input: {
    orderId: string;
    paymentAttemptId: string;
    stripeCheckoutSessionId: string;
  }): Promise<void>;
}

export interface HostedCheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  clientReferenceId: string | null;
  metadataOrderId: string | null;
  metadataPaymentAttemptId: string | null;
}

export interface StripeCheckoutGateway {
  createSession(input: {
    order: PersistedOrder;
    attempt: PaymentAttemptRecord;
    successUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  }): Promise<HostedCheckoutSession>;
  retrieveSession(sessionId: string): Promise<HostedCheckoutSession>;
}

export type CheckoutCreationResult =
  | {
      kind: "cash";
      orderId: string;
      confirmationPath: string;
      reused: boolean;
    }
  | {
      kind: "stripe";
      orderId: string;
      paymentAttemptId: string;
      checkoutSessionId: string;
      destination: "hosted_checkout" | "confirmation";
      redirectUrl: string;
      reused: boolean;
    };

export type CheckoutOrderState =
  | "pending"
  | "confirmed"
  | "expired"
  | "failed";

export type CheckoutOrderTrackingStepState =
  | "completed"
  | "current"
  | "upcoming";

export interface CheckoutOrderTrackingStep {
  status: OrderStatus;
  label: string;
  description: string;
  state: CheckoutOrderTrackingStepState;
  occurredAt: string | null;
}

export interface CheckoutOrderTracking {
  currentStatus: OrderStatus;
  currentLabel: string;
  steps: readonly CheckoutOrderTrackingStep[];
}

export interface CheckoutOrderStatusResult {
  state: CheckoutOrderState;
  cartCanBeCleared: boolean;
  tracking: CheckoutOrderTracking | null;
  order: {
    id: string;
    paymentMethod: CheckoutPaymentMethod;
    orderStatus: PersistedOrder["orderStatus"];
    paymentStatus: PersistedOrder["paymentStatus"];
    currency: "COP";
    subtotalCop: number;
    serviceFeeCop: number;
    totalCop: number;
    storeId: string;
    confirmedAt: string | null;
    createdAt: string;
    lines: readonly {
      productName: string;
      quantity: number;
      lineTotalCop: number;
    }[];
  };
}
