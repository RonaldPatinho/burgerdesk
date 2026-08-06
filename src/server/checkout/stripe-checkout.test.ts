import assert from "node:assert/strict";
import test from "node:test";
import type {
  PaymentAttemptRecord,
  PersistedOrder,
} from "../orders/types";
import { buildStripeCheckoutSessionParams } from "./stripe-checkout";

const attempt: PaymentAttemptRecord = {
  id: "attempt-1",
  orderId: "order-1",
  attemptNumber: 1,
  status: "pendiente",
  stripeCheckoutSessionId: null,
  stripePaymentIntentId: null,
  createdAt: "2026-08-05T12:00:00.000Z",
  updatedAt: "2026-08-05T12:00:00.000Z",
};

const order: PersistedOrder = {
  id: "order-1",
  clientSessionId: "session-1",
  clientId: null,
  storeId: "sede-centro",
  paymentMethod: "stripe",
  orderStatus: "pendiente_de_pago",
  operationalStatus: null,
  paymentStatus: "pendiente",
  currency: "COP",
  subtotalCop: 30_400,
  serviceFeeCop: 2_900,
  totalCop: 33_300,
  kitchenNote: "",
  confirmedAt: null,
  createdAt: "2026-08-05T12:00:00.000Z",
  updatedAt: "2026-08-05T12:00:00.000Z",
  lines: [
    {
      id: "line-1",
      productId: "la-bendita",
      productName: "La Bendita",
      quantity: 1,
      unitBasePriceCop: 26_900,
      unitPriceCop: 30_400,
      lineTotalCop: 30_400,
      options: [
        {
          id: "option-1",
          optionId: "cheddar-extra",
          optionName: "Cheddar extra",
          priceCop: 3_500,
        },
      ],
    },
  ],
  paymentAttempts: [attempt],
};

test("crea parametros Checkout en COP con unidades menores y asociaciones", () => {
  const params = buildStripeCheckoutSessionParams({
    order,
    attempt,
    successUrl:
      "http://localhost:3000/pedido/confirmacion?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "http://localhost:3000/pago?estado=cancelado",
  });

  assert.equal(params.mode, "payment");
  assert.equal(params.client_reference_id, order.id);
  assert.deepEqual(params.metadata, {
    order_id: order.id,
    payment_attempt_id: attempt.id,
  });
  assert.deepEqual(params.payment_intent_data?.metadata, params.metadata);
  assert.equal(params.line_items?.[0]?.price_data?.currency, "cop");
  assert.equal(params.line_items?.[0]?.price_data?.unit_amount, 3_040_000);
  assert.equal(params.line_items?.[1]?.price_data?.unit_amount, 290_000);
  assert.match(params.success_url ?? "", /\{CHECKOUT_SESSION_ID\}/);
  assert.equal(params.cancel_url, "http://localhost:3000/pago?estado=cancelado");
});
