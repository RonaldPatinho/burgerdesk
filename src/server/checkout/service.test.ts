import assert from "node:assert/strict";
import test from "node:test";
import type {
  CreatedInternalOrder,
  PaymentAttemptRecord,
  PersistedOrder,
  RecalculatedOrderDraft,
} from "../orders/types";
import { createCheckout, getCheckoutOrderStatus } from "./service";
import type {
  CheckoutOrderPersistence,
  CheckoutRequestInput,
  HostedCheckoutSession,
  StripeCheckoutGateway,
} from "./types";

const now = "2026-08-05T12:00:00.000Z";

function request(
  requestId = "request-1234567890",
  paymentMethod: "stripe" | "efectivo" = "stripe",
): CheckoutRequestInput {
  return {
    requestId,
    paymentMethod,
    termsAccepted: true,
    clientSession: { sessionId: "session-1", clientId: null },
    cart: {
      items: [
        {
          productId: "la-bendita",
          optionIds: ["cheddar-extra"],
          quantity: 1,
        },
      ],
      kitchenNote: "Sin cebolla",
    },
    retryOrderId: null,
  };
}

class FakePersistence implements CheckoutOrderPersistence {
  readonly orders = new Map<string, PersistedOrder>();
  readonly creationKeys = new Map<string, string>();
  readonly attemptKeys = new Map<string, PaymentAttemptRecord>();
  createCount = 0;
  attachCount = 0;

  async createOrder(
    draft: RecalculatedOrderDraft,
  ): Promise<CreatedInternalOrder> {
    const existingId = this.creationKeys.get(draft.creationIdempotencyKey);
    if (existingId) {
      const order = this.orders.get(existingId);
      if (!order) throw new Error("FAKE_ORDER_MISSING");
      return {
        order,
        paymentAttempt: order.paymentAttempts[0] ?? null,
        reused: true,
      };
    }

    this.createCount += 1;
    const orderId = `order-${this.createCount}`;
    const paymentAttempt: PaymentAttemptRecord | null =
      draft.paymentMethod === "stripe"
        ? {
            id: `attempt-${this.createCount}-1`,
            orderId,
            attemptNumber: 1,
            status: "pendiente",
            stripeCheckoutSessionId: null,
            stripePaymentIntentId: null,
            createdAt: now,
            updatedAt: now,
          }
        : null;
    if (draft.paymentMethod === "stripe" && paymentAttempt) {
      this.attemptKeys.set(
        draft.paymentRequestIdempotencyKey,
        paymentAttempt,
      );
    }
    const order: PersistedOrder = {
      id: orderId,
      clientSessionId: draft.clientSessionId,
      clientId: draft.clientId,
      storeId: draft.storeId,
      paymentMethod: draft.paymentMethod,
      orderStatus:
        draft.paymentMethod === "stripe" ? "pendiente_de_pago" : "confirmado",
      operationalStatus: draft.paymentMethod === "stripe" ? null : "recibido",
      paymentStatus:
        draft.paymentMethod === "stripe"
          ? "pendiente"
          : "pendiente_en_efectivo",
      currency: "COP",
      subtotalCop: draft.subtotalCop,
      serviceFeeCop: draft.serviceFeeCop,
      totalCop: draft.totalCop,
      kitchenNote: draft.kitchenNote,
      confirmedAt: draft.paymentMethod === "stripe" ? null : now,
      createdAt: now,
      updatedAt: now,
      lines: draft.lines.map((line, lineIndex) => ({
        id: `${orderId}-line-${lineIndex}`,
        ...line,
        options: line.options.map((option, optionIndex) => ({
          id: `${orderId}-option-${lineIndex}-${optionIndex}`,
          ...option,
        })),
      })),
      paymentAttempts: paymentAttempt ? [paymentAttempt] : [],
    };
    this.orders.set(orderId, order);
    this.creationKeys.set(draft.creationIdempotencyKey, orderId);
    return { order, paymentAttempt, reused: false };
  }

  async getOrderById(orderId: string): Promise<PersistedOrder | null> {
    return this.orders.get(orderId) ?? null;
  }

  async getOrderByCheckoutSessionId(
    checkoutSessionId: string,
  ): Promise<PersistedOrder | null> {
    return (
      [...this.orders.values()].find((order) =>
        order.paymentAttempts.some(
          (attempt) =>
            attempt.stripeCheckoutSessionId === checkoutSessionId,
        ),
      ) ?? null
    );
  }

  async createRetryPaymentAttempt(
    orderId: string,
    requestIdempotencyKey: string,
  ): Promise<{ attempt: PaymentAttemptRecord; reused: boolean }> {
    const existing = this.attemptKeys.get(requestIdempotencyKey);
    if (existing) return { attempt: existing, reused: true };
    const order = this.orders.get(orderId);
    if (!order) throw new Error("FAKE_ORDER_MISSING");
    const attempt: PaymentAttemptRecord = {
      id: `attempt-${orderId}-${order.paymentAttempts.length + 1}`,
      orderId,
      attemptNumber: order.paymentAttempts.length + 1,
      status: "pendiente",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.attemptKeys.set(requestIdempotencyKey, attempt);
    this.orders.set(orderId, {
      ...order,
      orderStatus: "pendiente_de_pago",
      paymentStatus: "pendiente",
      paymentAttempts: [...order.paymentAttempts, attempt],
    });
    return { attempt, reused: false };
  }

  async attachCheckoutSession(input: {
    orderId: string;
    paymentAttemptId: string;
    stripeCheckoutSessionId: string;
  }): Promise<void> {
    const order = this.orders.get(input.orderId);
    if (!order) throw new Error("FAKE_ORDER_MISSING");
    this.attachCount += 1;
    const attempts = order.paymentAttempts.map((attempt) =>
      attempt.id === input.paymentAttemptId
        ? { ...attempt, stripeCheckoutSessionId: input.stripeCheckoutSessionId }
        : attempt,
    );
    this.orders.set(order.id, { ...order, paymentAttempts: attempts });
  }

  setPaymentStatus(
    orderId: string,
    paymentStatus: PersistedOrder["paymentStatus"],
  ): void {
    const order = this.orders.get(orderId);
    if (!order) throw new Error("FAKE_ORDER_MISSING");
    const paid = paymentStatus === "pagado";
    this.orders.set(orderId, {
      ...order,
      orderStatus: paid ? "confirmado" : "pendiente_de_pago",
      operationalStatus: paid ? "recibido" : null,
      paymentStatus,
      confirmedAt: paid ? now : null,
      paymentAttempts: order.paymentAttempts.map((attempt, index) =>
        index === order.paymentAttempts.length - 1
          ? {
              ...attempt,
              status:
                paymentStatus === "pagado"
                  ? "pagado"
                  : paymentStatus === "expirado"
                    ? "expirado"
                    : attempt.status,
            }
          : attempt,
      ),
    });
  }
}

class FakeStripe implements StripeCheckoutGateway {
  readonly sessions = new Map<string, HostedCheckoutSession>();
  readonly idempotency = new Map<string, string>();
  readonly creations: Parameters<StripeCheckoutGateway["createSession"]>[0][] = [];
  createCount = 0;
  retrieveCount = 0;

  async createSession(
    input: Parameters<StripeCheckoutGateway["createSession"]>[0],
  ): Promise<HostedCheckoutSession> {
    const existingId = this.idempotency.get(input.idempotencyKey);
    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (!existing) throw new Error("FAKE_SESSION_MISSING");
      return existing;
    }
    this.createCount += 1;
    this.creations.push(input);
    const session: HostedCheckoutSession = {
      id: `cs_test_${this.createCount}`,
      url: `https://checkout.stripe.com/c/pay/test-${this.createCount}`,
      status: "open",
      clientReferenceId: input.order.id,
      metadataOrderId: input.order.id,
      metadataPaymentAttemptId: input.attempt.id,
    };
    this.sessions.set(session.id, session);
    this.idempotency.set(input.idempotencyKey, session.id);
    return session;
  }

  async retrieveSession(sessionId: string): Promise<HostedCheckoutSession> {
    this.retrieveCount += 1;
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("FAKE_SESSION_MISSING");
    return session;
  }
}

function dependencies() {
  return {
    persistence: new FakePersistence(),
    stripe: new FakeStripe(),
    appUrl: "http://localhost:3000",
  };
}

test("crea primero el pedido e intento canonicos y despues Checkout", async () => {
  const deps = dependencies();
  const result = await createCheckout(request(), deps);

  assert.equal(result.kind, "stripe");
  assert.equal(deps.persistence.createCount, 1);
  assert.equal(deps.stripe.createCount, 1);
  assert.equal(deps.persistence.attachCount, 1);
  const creation = deps.stripe.creations[0];
  assert.ok(creation);
  assert.equal(creation.order.currency, "COP");
  assert.equal(creation.order.subtotalCop, 30_400);
  assert.equal(creation.order.serviceFeeCop, 2_900);
  assert.equal(creation.order.totalCop, 33_300);
  assert.equal(creation.attempt.orderId, creation.order.id);
  assert.match(creation.successUrl, /\{CHECKOUT_SESSION_ID\}/);
  assert.equal(creation.cancelUrl, "http://localhost:3000/pago?estado=cancelado");
});

test("el doble envio reutiliza pedido, intento y sesion", async () => {
  const deps = dependencies();
  const first = await createCheckout(request(), deps);
  const second = await createCheckout(request(), deps);

  assert.equal(first.orderId, second.orderId);
  assert.equal(deps.persistence.createCount, 1);
  assert.equal(deps.stripe.createCount, 1);
  assert.equal(deps.stripe.retrieveCount, 1);
  assert.equal(deps.persistence.orders.size, 1);
});

test("volver por exito sin webhook mantiene el pedido pendiente", async () => {
  const deps = dependencies();
  const created = await createCheckout(request(), deps);
  assert.equal(created.kind, "stripe");
  if (created.kind !== "stripe") return;

  const status = await getCheckoutOrderStatus(
    {
      clientSessionId: "session-1",
      orderId: null,
      checkoutSessionId: created.checkoutSessionId,
    },
    deps.persistence,
  );
  assert.equal(status.state, "pending");
  assert.equal(status.cartCanBeCleared, false);
  assert.equal(status.tracking, null);
});

test("solo el estado pagado del servidor autoriza vaciar el carrito", async () => {
  const deps = dependencies();
  const created = await createCheckout(request(), deps);
  assert.equal(created.kind, "stripe");
  if (created.kind !== "stripe") return;
  deps.persistence.setPaymentStatus(created.orderId, "pagado");

  const status = await getCheckoutOrderStatus(
    {
      clientSessionId: "session-1",
      orderId: null,
      checkoutSessionId: created.checkoutSessionId,
    },
    deps.persistence,
  );
  assert.equal(status.state, "confirmed");
  assert.equal(status.cartCanBeCleared, true);
  assert.equal(status.tracking?.currentStatus, "preparing");
  assert.deepEqual(
    status.tracking?.steps.map((step) => step.state),
    ["completed", "current", "upcoming", "upcoming"],
  );
  assert.equal(status.tracking?.steps[0]?.occurredAt, now);
  assert.equal(status.tracking?.steps[0]?.description, "Pago validado.");
});

test("efectivo confirma el pedido sin crear sesion Stripe", async () => {
  const deps = dependencies();
  const created = await createCheckout(
    request("request-cash-123456", "efectivo"),
    deps,
  );
  assert.equal(created.kind, "cash");
  assert.equal(deps.stripe.createCount, 0);

  const status = await getCheckoutOrderStatus(
    {
      clientSessionId: "session-1",
      orderId: created.orderId,
      checkoutSessionId: null,
    },
    deps.persistence,
  );
  assert.equal(status.state, "confirmed");
  assert.equal(status.order.paymentStatus, "pendiente_en_efectivo");
  assert.equal(
    status.tracking?.steps[0]?.description,
    "Pago en efectivo al retirar.",
  );
});

test("una expiracion conserva el pedido y el reintento crea solo otro intento", async () => {
  const deps = dependencies();
  const first = await createCheckout(request(), deps);
  assert.equal(first.kind, "stripe");
  if (first.kind !== "stripe") return;
  deps.persistence.setPaymentStatus(first.orderId, "expirado");

  const expired = await getCheckoutOrderStatus(
    {
      clientSessionId: "session-1",
      orderId: null,
      checkoutSessionId: first.checkoutSessionId,
    },
    deps.persistence,
  );
  assert.equal(expired.state, "expired");
  assert.equal(expired.cartCanBeCleared, false);
  assert.equal(expired.tracking, null);

  const retryInput = request("request-retry-12345");
  retryInput.retryOrderId = first.orderId;
  const retried = await createCheckout(retryInput, deps);
  assert.equal(retried.orderId, first.orderId);
  assert.equal(deps.persistence.createCount, 1);
  assert.equal(deps.persistence.orders.get(first.orderId)?.paymentAttempts.length, 2);
  assert.equal(deps.stripe.createCount, 2);
});
