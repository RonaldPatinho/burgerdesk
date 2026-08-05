import type {
  PaymentAttemptRecord,
  PersistedOrder,
} from "../orders/types";
import {
  assertRetryMatchesCanonical,
  buildCanonicalCheckout,
  CheckoutValidationError,
} from "./canonical-order";
import type {
  CheckoutCreationResult,
  CheckoutOrderPersistence,
  CheckoutOrderState,
  CheckoutOrderStatusResult,
  CheckoutRequestInput,
  HostedCheckoutSession,
  StripeCheckoutGateway,
} from "./types";

export class CheckoutFlowError extends Error {
  constructor(
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "PAYMENT_ATTEMPT_MISSING"
      | "SESSION_MISMATCH"
      | "SESSION_EXPIRED"
      | "HOSTED_URL_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutFlowError";
  }
}

function confirmationPathForSession(sessionId: string): string {
  return `/pedido/confirmacion?session_id=${encodeURIComponent(sessionId)}`;
}

function assertSessionAssociation(
  session: HostedCheckoutSession,
  order: PersistedOrder,
  attempt: PaymentAttemptRecord,
): void {
  if (
    session.clientReferenceId !== order.id ||
    session.metadataOrderId !== order.id ||
    session.metadataPaymentAttemptId !== attempt.id
  ) {
    throw new CheckoutFlowError(
      "SESSION_MISMATCH",
      "La sesion de Stripe no coincide con el pedido interno.",
    );
  }
}

function assertHostedCheckoutUrl(value: string | null): string {
  if (!value) {
    throw new CheckoutFlowError(
      "HOSTED_URL_INVALID",
      "Stripe no devolvio una URL de pago alojada.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CheckoutFlowError(
      "HOSTED_URL_INVALID",
      "Stripe no devolvio una URL de pago alojada.",
    );
  }
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
    throw new CheckoutFlowError(
      "HOSTED_URL_INVALID",
      "Stripe no devolvio una URL de pago alojada.",
    );
  }
  return url.toString();
}

async function resolveStripeAttempt(
  input: CheckoutRequestInput,
  persistence: CheckoutOrderPersistence,
): Promise<{
  order: PersistedOrder;
  attempt: PaymentAttemptRecord;
  reused: boolean;
  requestIdempotencyKey: string;
}> {
  const canonical = buildCanonicalCheckout(input);
  if (canonical.draft.paymentMethod !== "stripe") {
    throw new CheckoutValidationError(
      "CART_INVALID",
      "El pedido no usa pago en linea.",
    );
  }

  if (input.retryOrderId) {
    const order = await persistence.getOrderById(input.retryOrderId);
    if (!order) {
      throw new CheckoutFlowError(
        "ORDER_NOT_FOUND",
        "El pedido que intentas pagar no existe.",
      );
    }
    assertRetryMatchesCanonical(order, canonical, input);
    const retry = await persistence.createRetryPaymentAttempt(
      order.id,
      canonical.draft.paymentRequestIdempotencyKey,
    );
    const refreshedOrder = await persistence.getOrderById(order.id);
    if (!refreshedOrder) {
      throw new CheckoutFlowError(
        "ORDER_NOT_FOUND",
        "El pedido que intentas pagar no existe.",
      );
    }
    return {
      order: refreshedOrder,
      attempt: retry.attempt,
      reused: retry.reused,
      requestIdempotencyKey:
        canonical.draft.paymentRequestIdempotencyKey,
    };
  }

  const created = await persistence.createOrder(canonical.draft);
  if (!created.paymentAttempt) {
    throw new CheckoutFlowError(
      "PAYMENT_ATTEMPT_MISSING",
      "El pedido no tiene un intento de pago asociado.",
    );
  }
  return {
    order: created.order,
    attempt: created.paymentAttempt,
    reused: created.reused,
    requestIdempotencyKey: canonical.draft.paymentRequestIdempotencyKey,
  };
}

export async function createCheckout(
  input: CheckoutRequestInput,
  dependencies: {
    persistence: CheckoutOrderPersistence;
    stripe: StripeCheckoutGateway;
    appUrl: string;
  },
): Promise<CheckoutCreationResult> {
  const canonical = buildCanonicalCheckout(input);

  if (input.paymentMethod === "efectivo") {
    if (input.retryOrderId) {
      throw new CheckoutValidationError(
        "ORDER_NOT_RETRYABLE",
        "El reintento solo aplica a un pago en linea.",
      );
    }
    const created = await dependencies.persistence.createOrder(canonical.draft);
    return {
      kind: "cash",
      orderId: created.order.id,
      confirmationPath: `/pedido/confirmacion?order_id=${encodeURIComponent(
        created.order.id,
      )}`,
      reused: created.reused,
    };
  }

  const resolved = await resolveStripeAttempt(input, dependencies.persistence);
  const existingSessionId = resolved.attempt.stripeCheckoutSessionId;
  let session: HostedCheckoutSession;

  if (existingSessionId) {
    session = await dependencies.stripe.retrieveSession(existingSessionId);
  } else {
    session = await dependencies.stripe.createSession({
      order: resolved.order,
      attempt: resolved.attempt,
      successUrl: `${dependencies.appUrl}/pedido/confirmacion?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${dependencies.appUrl}/pago?estado=cancelado`,
      idempotencyKey: resolved.requestIdempotencyKey,
    });
  }

  assertSessionAssociation(session, resolved.order, resolved.attempt);

  if (session.status === "expired") {
    throw new CheckoutFlowError(
      "SESSION_EXPIRED",
      "La sesion de pago expiro. Espera la verificacion antes de reintentar.",
    );
  }

  await dependencies.persistence.attachCheckoutSession({
    orderId: resolved.order.id,
    paymentAttemptId: resolved.attempt.id,
    stripeCheckoutSessionId: session.id,
  });

  const destination = session.status === "complete"
    ? "confirmation"
    : "hosted_checkout";
  return {
    kind: "stripe",
    orderId: resolved.order.id,
    paymentAttemptId: resolved.attempt.id,
    checkoutSessionId: session.id,
    destination,
    redirectUrl:
      destination === "confirmation"
        ? confirmationPathForSession(session.id)
        : assertHostedCheckoutUrl(session.url),
    reused: resolved.reused || existingSessionId !== null,
  };
}

function getOrderState(order: PersistedOrder): CheckoutOrderState {
  if (
    order.orderStatus === "confirmado" &&
    (order.paymentStatus === "pagado" ||
      order.paymentStatus === "pendiente_en_efectivo")
  ) {
    return "confirmed";
  }
  if (order.paymentStatus === "expirado") return "expired";
  if (order.paymentStatus === "fallido") return "failed";
  return "pending";
}

export async function getCheckoutOrderStatus(
  input: {
    clientSessionId: string;
    orderId: string | null;
    checkoutSessionId: string | null;
  },
  persistence: CheckoutOrderPersistence,
): Promise<CheckoutOrderStatusResult> {
  const order = input.checkoutSessionId
    ? await persistence.getOrderByCheckoutSessionId(input.checkoutSessionId)
    : input.orderId
      ? await persistence.getOrderById(input.orderId)
      : null;
  if (!order || order.clientSessionId !== input.clientSessionId) {
    throw new CheckoutFlowError(
      "ORDER_NOT_FOUND",
      "No encontramos el pedido para esta sesion.",
    );
  }

  const state = getOrderState(order);
  return {
    state,
    cartCanBeCleared: state === "confirmed",
    order: {
      id: order.id,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotalCop: order.subtotalCop,
      serviceFeeCop: order.serviceFeeCop,
      totalCop: order.totalCop,
      storeId: order.storeId,
      confirmedAt: order.confirmedAt,
      createdAt: order.createdAt,
      lines: order.lines.map((line) => ({
        productName: line.productName,
        quantity: line.quantity,
        lineTotalCop: line.lineTotalCop,
      })),
    },
  };
}
