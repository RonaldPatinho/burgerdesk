import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { mapStripeEvent } from "./webhook";

const syntheticWebhookSecret = "whsec_synthetic_test_only";

function createSyntheticPayload(): string {
  return JSON.stringify({
    id: "evt_synthetic_completed",
    object: "event",
    api_version: "2026-07-29.basil",
    created: 1_785_886_400,
    data: {
      object: {
        id: "cs_test_synthetic",
        object: "checkout.session",
        amount_total: 3_700_000,
        client_reference_id: "order-synthetic",
        currency: "cop",
        metadata: {
          order_id: "order-synthetic",
          payment_attempt_id: "attempt-synthetic",
        },
        mode: "payment",
        payment_intent: "pi_synthetic",
        payment_status: "paid",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: "checkout.session.completed",
  });
}

test("verifica una firma sintetica y mapea solo datos operativos", () => {
  const stripe = new Stripe("sk_test_synthetic_only", { telemetry: false });
  const payload = createSyntheticPayload();
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: syntheticWebhookSecret,
  });
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    syntheticWebhookSecret,
  );

  assert.deepEqual(mapStripeEvent(event), {
    eventId: "evt_synthetic_completed",
    eventType: "checkout.session.completed",
    eventCreatedAt: new Date(1_785_886_400_000),
    session: {
      id: "cs_test_synthetic",
      mode: "payment",
      paymentStatus: "paid",
      amountTotalMinor: 3_700_000,
      currency: "cop",
      clientReferenceId: "order-synthetic",
      metadataOrderId: "order-synthetic",
      metadataPaymentAttemptId: "attempt-synthetic",
      paymentIntentId: "pi_synthetic",
    },
  });
});

test("rechaza una firma sintetica que no corresponde al cuerpo", () => {
  const stripe = new Stripe("sk_test_synthetic_only", { telemetry: false });
  const payload = createSyntheticPayload();
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: syntheticWebhookSecret,
  });

  assert.throws(() =>
    stripe.webhooks.constructEvent(
      `${payload} `,
      signature,
      syntheticWebhookSecret,
    ),
  );
});
