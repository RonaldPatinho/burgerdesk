import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import {
  closeMySqlPool,
  getMySqlPool,
} from "../database/mysql";
import {
  attachStripeCheckoutSession,
  createInternalOrder,
  createRetryPaymentAttempt,
  getInternalOrderById,
  OrderPersistenceError,
  processStripeWebhookEvent,
} from "./mysql-order-repository";
import type {
  RecalculatedOrderDraft,
  StripeWebhookEventData,
} from "./types";

const runId = randomUUID();
const clientSessionId = `integration-hito6-${runId}`;

function key(label: string): string {
  return `${label}-${runId}`;
}

function createDraft(
  label: string,
  paymentMethod: "stripe" | "efectivo" = "stripe",
): RecalculatedOrderDraft {
  const base = {
    creationIdempotencyKey: key(`order-${label}`),
    clientSessionId,
    clientId: null,
    storeId: "sede-principal",
    kitchenNote: "Sin cambios",
    subtotalCop: 34_000,
    serviceFeeCop: 3_000,
    totalCop: 37_000,
    lines: [
      {
        productId: "la-bendita",
        productName: "La Bendita",
        quantity: 2,
        unitBasePriceCop: 15_000,
        unitPriceCop: 17_000,
        lineTotalCop: 34_000,
        options: [
          {
            optionId: "cheddar-extra",
            optionName: "Cheddar extra",
            priceCop: 2_000,
          },
        ],
      },
    ],
  } as const;

  return paymentMethod === "stripe"
    ? {
        ...base,
        paymentMethod,
        paymentRequestIdempotencyKey: key(`attempt-${label}`),
      }
    : { ...base, paymentMethod };
}

function sessionId(label: string): string {
  return `cs_test_${label}_${runId.replaceAll("-", "")}`;
}

function webhookEvent(input: {
  eventId: string;
  eventType: string;
  orderId: string;
  attemptId: string;
  checkoutSessionId: string;
  paymentStatus?: string;
  paymentIntentId?: string | null;
}): StripeWebhookEventData {
  return {
    eventId: key(input.eventId),
    eventType: input.eventType,
    eventCreatedAt: new Date("2026-08-04T16:00:00.000Z"),
    session: {
      id: input.checkoutSessionId,
      mode: "payment",
      paymentStatus: input.paymentStatus ?? "unpaid",
      amountTotalMinor: 3_700_000,
      currency: "cop",
      clientReferenceId: input.orderId,
      metadataOrderId: input.orderId,
      metadataPaymentAttemptId: input.attemptId,
      paymentIntentId: input.paymentIntentId ?? null,
    },
  };
}

after(async () => {
  const pool = getMySqlPool();
  await pool.execute(
    "DELETE FROM stripe_webhook_events WHERE stripe_event_id LIKE ?",
    [`%-${runId}`],
  );
  await pool.execute("DELETE FROM orders WHERE client_session_id = ?", [
    clientSessionId,
  ]);
  await closeMySqlPool();
});

test("crea efectivo en una transaccion y reutiliza el pedido sin duplicarlo", async () => {
  const draft = createDraft("cash", "efectivo");
  const [first, second] = await Promise.all([
    createInternalOrder(draft),
    createInternalOrder(draft),
  ]);

  assert.equal(first.order.id, second.order.id);
  assert.equal([first.reused, second.reused].filter(Boolean).length, 1);
  assert.equal(first.order.paymentMethod, "efectivo");
  assert.equal(first.order.paymentStatus, "pendiente_en_efectivo");
  assert.equal(first.order.orderStatus, "confirmado");
  assert.equal(first.order.paymentAttempts.length, 0);
  assert.equal(first.order.lines[0]?.options[0]?.optionId, "cheddar-extra");

  await assert.rejects(
    createInternalOrder({ ...draft, kitchenNote: "Otra nota" }),
    (error: unknown) =>
      error instanceof OrderPersistenceError &&
      error.code === "IDEMPOTENCY_KEY_REUSED",
  );
});

test("revierte todo el pedido si la clave de intento ya pertenece a otro", async () => {
  const originalDraft = createDraft("rollback-origin");
  if (originalDraft.paymentMethod !== "stripe") {
    throw new Error("La prueba requiere un pedido Stripe.");
  }
  const original = await createInternalOrder(originalDraft);
  const conflictingDraft = {
    ...createDraft("rollback-conflict"),
    paymentRequestIdempotencyKey: originalDraft.paymentRequestIdempotencyKey,
  };

  await assert.rejects(
    createInternalOrder(conflictingDraft),
    (error: unknown) =>
      error instanceof OrderPersistenceError &&
      error.code === "IDEMPOTENCY_KEY_REUSED",
  );

  const [rows] = await getMySqlPool().execute<
    (RowDataPacket & { order_count: number })[]
  >(
    "SELECT COUNT(*) AS order_count FROM orders WHERE creation_idempotency_key = ?",
    [conflictingDraft.creationIdempotencyKey],
  );
  assert.equal(Number(rows[0]?.order_count), 0);
  assert.ok(await getInternalOrderById(original.order.id));
});

test("el webhook confirma una sola vez y nunca degrada un pedido pagado", async () => {
  const created = await createInternalOrder(createDraft("paid-webhook"));
  const attempt = created.paymentAttempt;
  assert.ok(attempt);
  const checkoutSessionId = sessionId("paid");
  await attachStripeCheckoutSession({
    orderId: created.order.id,
    paymentAttemptId: attempt.id,
    stripeCheckoutSessionId: checkoutSessionId,
  });

  const paidEvent = webhookEvent({
    eventId: "paid",
    eventType: "checkout.session.completed",
    orderId: created.order.id,
    attemptId: attempt.id,
    checkoutSessionId,
    paymentStatus: "paid",
    paymentIntentId: `pi_${runId.replaceAll("-", "")}`,
  });
  const first = await processStripeWebhookEvent(paidEvent);
  const duplicate = await processStripeWebhookEvent(paidEvent);
  const [eventCountRows] = await getMySqlPool().execute<
    (RowDataPacket & { event_count: number })[]
  >(
    "SELECT COUNT(*) AS event_count FROM stripe_webhook_events WHERE stripe_event_id = ?",
    [paidEvent.eventId],
  );
  const lateExpiration = await processStripeWebhookEvent(
    webhookEvent({
      eventId: "late-expiration",
      eventType: "checkout.session.expired",
      orderId: created.order.id,
      attemptId: attempt.id,
      checkoutSessionId,
    }),
  );
  const order = await getInternalOrderById(created.order.id);

  assert.deepEqual(first, {
    duplicate: false,
    outcome: "procesado",
    orderId: created.order.id,
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(Number(eventCountRows[0]?.event_count), 1);
  assert.equal(lateExpiration.outcome, "procesado");
  assert.equal(order?.paymentStatus, "pagado");
  assert.equal(order?.orderStatus, "confirmado");
  assert.equal(order?.paymentAttempts[0]?.status, "pagado");
});

test("un evento antiguo no degrada un reintento pendiente y la sesion es unica", async () => {
  const created = await createInternalOrder(createDraft("retry"));
  const firstAttempt = created.paymentAttempt;
  assert.ok(firstAttempt);
  const firstSessionId = sessionId("retry_first");
  await attachStripeCheckoutSession({
    orderId: created.order.id,
    paymentAttemptId: firstAttempt.id,
    stripeCheckoutSessionId: firstSessionId,
  });
  await processStripeWebhookEvent(
    webhookEvent({
      eventId: "retry-first-expiration",
      eventType: "checkout.session.expired",
      orderId: created.order.id,
      attemptId: firstAttempt.id,
      checkoutSessionId: firstSessionId,
    }),
  );

  const retry = await createRetryPaymentAttempt(
    created.order.id,
    key("retry-attempt-request"),
  );
  const retryAgain = await createRetryPaymentAttempt(
    created.order.id,
    key("retry-attempt-request"),
  );
  assert.equal(retryAgain.reused, true);
  assert.equal(retryAgain.attempt.id, retry.attempt.id);

  const secondSessionId = sessionId("retry_second");
  await attachStripeCheckoutSession({
    orderId: created.order.id,
    paymentAttemptId: retry.attempt.id,
    stripeCheckoutSessionId: secondSessionId,
  });
  await processStripeWebhookEvent(
    webhookEvent({
      eventId: "retry-late-first-expiration",
      eventType: "checkout.session.expired",
      orderId: created.order.id,
      attemptId: firstAttempt.id,
      checkoutSessionId: firstSessionId,
    }),
  );
  const stillPending = await getInternalOrderById(created.order.id);
  assert.equal(stillPending?.paymentStatus, "pendiente");
  assert.equal(stillPending?.paymentAttempts[1]?.status, "pendiente");

  const other = await createInternalOrder(createDraft("unique-session"));
  assert.ok(other.paymentAttempt);
  await assert.rejects(
    attachStripeCheckoutSession({
      orderId: other.order.id,
      paymentAttemptId: other.paymentAttempt.id,
      stripeCheckoutSessionId: secondSessionId,
    }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY",
  );
});
