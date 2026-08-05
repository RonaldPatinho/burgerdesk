import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { closeMySqlPool, getMySqlPool } from "../database/mysql";
import {
  getSessionByToken,
  loginClient,
  registerClient,
  revokeSessionByToken,
} from "../auth/repository";
import {
  attachStripeCheckoutSession,
  createInternalOrder,
  processStripeWebhookEvent,
} from "../orders/mysql-order-repository";
import type { RecalculatedOrderDraft } from "../orders/types";
import {
  ClientProfileRepositoryError,
  getClientAvatar,
  getClientOrderDetail,
  getClientProfileDashboard,
  updateClientProfile,
} from "./repository";

const runId = randomUUID();
const emailA = `profile-a-${runId}@example.com`;
const emailB = `profile-b-${runId}@example.com`;
const createdUserIds: string[] = [];

function draft(input: {
  label: string;
  userId: string;
  sessionId: string;
  paymentMethod: "stripe" | "efectivo";
}): RecalculatedOrderDraft {
  const base = {
    creationIdempotencyKey: `profile-order-${input.label}-${runId}`,
    clientSessionId: input.sessionId,
    clientId: input.userId,
    userId: input.userId,
    storeId: "sede-centro",
    kitchenNote: "",
    subtotalCop: 34_000,
    serviceFeeCop: 3_000,
    totalCop: 37_000,
    lines: [
      {
        productId: "la-bendita",
        productName: "La Bendita",
        quantity: 2,
        unitBasePriceCop: 17_000,
        unitPriceCop: 17_000,
        lineTotalCop: 34_000,
        options: [],
      },
    ],
  } as const;
  return input.paymentMethod === "stripe"
    ? {
        ...base,
        paymentMethod: "stripe",
        paymentRequestIdempotencyKey: `profile-attempt-${input.label}-${runId}`,
      }
    : { ...base, paymentMethod: "efectivo" };
}

after(async () => {
  const pool = getMySqlPool();
  if (createdUserIds.length > 0) {
    const placeholders = createdUserIds.map(() => "?").join(", ");
    await pool.execute(`DELETE FROM orders WHERE user_id IN (${placeholders})`, createdUserIds);
    await pool.execute(`DELETE FROM client_users WHERE id IN (${placeholders})`, createdUserIds);
  }
  await closeMySqlPool();
});

test("sesión real, perfil propio, asociación, estadísticas, avatar y revocación", async () => {
  const registeredA = await registerClient({
    fullName: "Cliente A",
    email: emailA,
    password: "clave-segura-a",
  });
  const registeredB = await registerClient({
    fullName: "Cliente B",
    email: emailB,
    password: "clave-segura-b",
  });
  createdUserIds.push(registeredA.session.userId, registeredB.session.userId);

  const login = await loginClient({ email: emailA, password: "clave-segura-a" });
  assert.equal(login.session.userId, registeredA.session.userId);
  assert.equal((await getSessionByToken(login.token))?.userId, registeredA.session.userId);

  const cash = await createInternalOrder(
    draft({
      label: "cash",
      userId: registeredA.session.userId,
      sessionId: login.session.sessionId,
      paymentMethod: "efectivo",
    }),
  );
  const stripe = await createInternalOrder(
    draft({
      label: "stripe",
      userId: registeredA.session.userId,
      sessionId: login.session.sessionId,
      paymentMethod: "stripe",
    }),
  );
  assert.equal(cash.order.userId, registeredA.session.userId);
  assert.ok(stripe.paymentAttempt);
  const checkoutSessionId = `cs_test_profile_${runId.replaceAll("-", "")}`;
  await attachStripeCheckoutSession({
    orderId: stripe.order.id,
    paymentAttemptId: stripe.paymentAttempt.id,
    stripeCheckoutSessionId: checkoutSessionId,
  });
  await processStripeWebhookEvent({
    eventId: `evt_profile_${runId}`,
    eventType: "checkout.session.completed",
    eventCreatedAt: new Date(),
    session: {
      id: checkoutSessionId,
      mode: "payment",
      paymentStatus: "paid",
      amountTotalMinor: 3_700_000,
      currency: "cop",
      clientReferenceId: stripe.order.id,
      metadataOrderId: stripe.order.id,
      metadataPaymentAttemptId: stripe.paymentAttempt.id,
      paymentIntentId: `pi_profile_${runId}`,
    },
  });

  const updated = await updateClientProfile(
    registeredA.session.userId,
    {
      fullName: "Cliente Actualizada",
      email: emailA,
      phone: "+57 300 123 4567",
      preferredStoreId: "sede-centro",
      contactWhatsapp: false,
      contactEmail: true,
    },
    {
      mimeType: "image/png",
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
    },
  );
  assert.equal(updated.fullName, "Cliente Actualizada");
  assert.equal(updated.hasAvatar, true);
  assert.equal((await getClientAvatar(registeredA.session.userId))?.mimeType, "image/png");

  const dashboard = await getClientProfileDashboard(registeredA.session.userId);
  assert.equal(dashboard.stats.orderCount, 2);
  assert.equal(dashboard.stats.favoriteCount, 0);
  assert.equal(dashboard.stats.totalPaidCop, 37_000);
  assert.equal(dashboard.recentOrders.length, 2);
  assert.equal((await getClientProfileDashboard(registeredB.session.userId)).stats.orderCount, 0);
  assert.equal((await getClientOrderDetail(registeredA.session.userId, stripe.order.id)).id, stripe.order.id);
  await assert.rejects(
    getClientOrderDetail(registeredB.session.userId, stripe.order.id),
    (error: unknown) =>
      error instanceof ClientProfileRepositoryError && error.code === "ORDER_NOT_FOUND",
  );
  await assert.rejects(
    updateClientProfile(
      registeredA.session.userId,
      {
        fullName: "Cliente Actualizada",
        email: emailB,
        phone: "+57 300 123 4567",
        preferredStoreId: "sede-centro",
        contactWhatsapp: true,
        contactEmail: false,
      },
      null,
    ),
    (error: unknown) =>
      error instanceof ClientProfileRepositoryError &&
      error.code === "EMAIL_ALREADY_EXISTS",
  );

  await revokeSessionByToken(login.token);
  assert.equal(await getSessionByToken(login.token), null);
});
