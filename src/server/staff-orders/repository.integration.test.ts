import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  closeMySqlPool,
  getMySqlPool,
} from "../database/mysql";
import { createInternalOrder } from "../orders/mysql-order-repository";
import type { RecalculatedOrderDraft } from "../orders/types";
import {
  getStaffOrderDetail,
  StaffOrderRepositoryError,
  updateStaffOrderOperationalStatus,
} from "./repository";

const runId = randomUUID();
const staffUserId = randomUUID();
const clientSessionId = `integration-personal-${runId}`;

function cashDraft(): RecalculatedOrderDraft {
  return {
    creationIdempotencyKey: `staff-order-${runId}`,
    clientSessionId,
    clientId: null,
    storeId: "sede-principal",
    paymentMethod: "efectivo",
    kitchenNote: "Salsa aparte",
    subtotalCop: 30_400,
    serviceFeeCop: 2_900,
    totalCop: 33_300,
    lines: [
      {
        productId: "la-bendita",
        productName: "La Bendita",
        quantity: 1,
        unitBasePriceCop: 26_900,
        unitPriceCop: 30_400,
        lineTotalCop: 30_400,
        options: [
          {
            optionId: "cheddar-extra",
            optionName: "Cheddar extra",
            priceCop: 3_500,
          },
        ],
      },
    ],
  };
}

after(async () => {
  const pool = getMySqlPool();
  await pool.execute("DELETE FROM orders WHERE client_session_id = ?", [
    clientSessionId,
  ]);
  await pool.execute("DELETE FROM internal_users WHERE id = ?", [staffUserId]);
  await closeMySqlPool();
});

test("consulta el detalle y registra transiciones secuenciales del personal", async () => {
  await getMySqlPool().execute(
    `INSERT INTO internal_users (
      id, username, username_normalized, full_name, email,
      email_normalized, password_hash, role, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'caja_cocina', TRUE)`,
    [
      staffUserId,
      `staff-${runId}`,
      `staff-${runId}`,
      "Personal de prueba",
      `staff-${runId}@burgerdesk.local`,
      `staff-${runId}@burgerdesk.local`,
      "test-hash-not-used",
    ],
  );

  const created = await createInternalOrder(cashDraft());
  const initial = await getStaffOrderDetail(created.order.id);
  if (!initial) throw new Error("STAFF_ORDER_DETAIL_MISSING");
  assert.equal(initial.customerName, "Cliente invitado");
  assert.equal(initial.operationalStatus, "recibido");
  assert.equal(initial.lines[0]?.options[0]?.optionName, "Cheddar extra");
  assert.deepEqual(
    initial.history.map((entry) => entry.newStatus),
    ["recibido"],
  );

  const preparing = await updateStaffOrderOperationalStatus({
    orderId: created.order.id,
    expectedStatus: "recibido",
    nextStatus: "en_preparacion",
    staffUserId,
  });
  assert.equal(preparing.operationalStatus, "en_preparacion");
  assert.deepEqual(
    preparing.history.map((entry) => entry.newStatus),
    ["recibido", "en_preparacion"],
  );

  await assert.rejects(
    updateStaffOrderOperationalStatus({
      orderId: created.order.id,
      expectedStatus: "en_preparacion",
      nextStatus: "entregado",
      staffUserId,
    }),
    (error: unknown) =>
      error instanceof StaffOrderRepositoryError &&
      error.code === "INVALID_TRANSITION",
  );

  await assert.rejects(
    updateStaffOrderOperationalStatus({
      orderId: created.order.id,
      expectedStatus: "recibido",
      nextStatus: "en_preparacion",
      staffUserId,
    }),
    (error: unknown) =>
      error instanceof StaffOrderRepositoryError &&
      error.code === "STATUS_CONFLICT",
  );

  const ready = await updateStaffOrderOperationalStatus({
    orderId: created.order.id,
    expectedStatus: "en_preparacion",
    nextStatus: "listo_para_retirar",
    staffUserId,
  });
  assert.equal(ready.operationalStatus, "listo_para_retirar");

  const delivered = await updateStaffOrderOperationalStatus({
    orderId: created.order.id,
    expectedStatus: "listo_para_retirar",
    nextStatus: "entregado",
    staffUserId,
  });
  assert.equal(delivered.operationalStatus, "entregado");
  assert.deepEqual(
    delivered.history.map((entry) => entry.newStatus),
    ["recibido", "en_preparacion", "listo_para_retirar", "entregado"],
  );
});
