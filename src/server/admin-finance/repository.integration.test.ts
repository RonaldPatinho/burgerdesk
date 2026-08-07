import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { closeMySqlPool, getMySqlPool } from "../database/mysql";
import {
  getAdministratorFinancialSnapshot,
  getAdministratorTransactions,
} from "./repository";

const runId = randomUUID();
const sessionPrefix = `integration-admin-finance-${runId}`;
const storeId = `integration-admin-finance-${runId}`;
const now = new Date("2026-08-06T16:30:00.000Z");

const orderIds = {
  paidA: randomUUID(),
  paidB: randomUUID(),
  previousPaid: randomUUID(),
  stripePending: randomUUID(),
  cashPending: randomUUID(),
  stripeExpired: randomUUID(),
};

type SeedOrder = {
  id: string;
  sequence: number;
  paymentMethod: "stripe" | "efectivo";
  orderStatus: "pendiente_de_pago" | "confirmado";
  operationalStatus: "recibido" | null;
  paymentStatus:
    | "pendiente"
    | "pendiente_en_efectivo"
    | "pagado"
    | "expirado";
  totalCop: number;
  createdAt: Date;
  confirmedAt: Date | null;
  attemptStatus?: "pendiente" | "pagado" | "expirado";
  completedAt?: Date | null;
  expiredAt?: Date | null;
  lines: Array<{
    productId: string;
    productName: string;
    quantity: number;
    lineTotalCop: number;
  }>;
};

const orders: SeedOrder[] = [
  {
    id: orderIds.paidA,
    sequence: 1,
    paymentMethod: "stripe",
    orderStatus: "confirmado",
    operationalStatus: "recibido",
    paymentStatus: "pagado",
    totalCop: 30_000,
    createdAt: new Date("2026-08-06T08:50:00.000Z"),
    confirmedAt: new Date("2026-08-06T09:00:00.000Z"),
    attemptStatus: "pagado",
    completedAt: new Date("2026-08-06T09:00:00.000Z"),
    lines: [
      {
        productId: "la-bendita",
        productName: "La Bendita",
        quantity: 2,
        lineTotalCop: 30_000,
      },
    ],
  },
  {
    id: orderIds.paidB,
    sequence: 2,
    paymentMethod: "stripe",
    orderStatus: "confirmado",
    operationalStatus: "recibido",
    paymentStatus: "pagado",
    totalCop: 20_000,
    createdAt: new Date("2026-08-06T08:55:00.000Z"),
    confirmedAt: new Date("2026-08-06T09:00:00.000Z"),
    attemptStatus: "pagado",
    completedAt: new Date("2026-08-06T09:00:00.000Z"),
    lines: [
      {
        productId: "la-bendita",
        productName: "La Bendita",
        quantity: 1,
        lineTotalCop: 10_000,
      },
      {
        productId: "doble-pecado",
        productName: "Doble Pecado",
        quantity: 1,
        lineTotalCop: 10_000,
      },
    ],
  },
  {
    id: orderIds.previousPaid,
    sequence: 3,
    paymentMethod: "stripe",
    orderStatus: "confirmado",
    operationalStatus: "recibido",
    paymentStatus: "pagado",
    totalCop: 10_000,
    createdAt: new Date("2026-08-05T09:50:00.000Z"),
    confirmedAt: new Date("2026-08-05T10:00:00.000Z"),
    attemptStatus: "pagado",
    completedAt: new Date("2026-08-05T10:00:00.000Z"),
    lines: [
      {
        productId: "santa-pollo",
        productName: "Santa Pollo",
        quantity: 1,
        lineTotalCop: 10_000,
      },
    ],
  },
  {
    id: orderIds.stripePending,
    sequence: 4,
    paymentMethod: "stripe",
    orderStatus: "pendiente_de_pago",
    operationalStatus: null,
    paymentStatus: "pendiente",
    totalCop: 15_000,
    createdAt: new Date("2026-08-06T11:00:00.000Z"),
    confirmedAt: null,
    attemptStatus: "pendiente",
    lines: [
      {
        productId: "santa-pollo",
        productName: "Santa Pollo",
        quantity: 1,
        lineTotalCop: 15_000,
      },
    ],
  },
  {
    id: orderIds.cashPending,
    sequence: 5,
    paymentMethod: "efectivo",
    orderStatus: "confirmado",
    operationalStatus: "recibido",
    paymentStatus: "pendiente_en_efectivo",
    totalCop: 18_000,
    createdAt: new Date("2026-08-06T12:00:00.000Z"),
    confirmedAt: new Date("2026-08-06T12:00:00.000Z"),
    lines: [
      {
        productId: "doble-pecado",
        productName: "Doble Pecado",
        quantity: 1,
        lineTotalCop: 18_000,
      },
    ],
  },
  {
    id: orderIds.stripeExpired,
    sequence: 6,
    paymentMethod: "stripe",
    orderStatus: "pendiente_de_pago",
    operationalStatus: null,
    paymentStatus: "expirado",
    totalCop: 16_000,
    createdAt: new Date("2026-08-06T12:30:00.000Z"),
    confirmedAt: null,
    attemptStatus: "expirado",
    expiredAt: new Date("2026-08-06T13:00:00.000Z"),
    lines: [
      {
        productId: "la-bendita",
        productName: "La Bendita",
        quantity: 1,
        lineTotalCop: 16_000,
      },
    ],
  },
];

async function seedOrder(order: SeedOrder): Promise<void> {
  const pool = getMySqlPool();
  await pool.execute(
    `INSERT INTO orders (
      id, creation_idempotency_key, request_fingerprint_sha256,
      client_session_id, client_id, user_id, store_id, payment_method,
      order_status, operational_status, payment_status, currency,
      subtotal_cop, service_fee_cop, total_cop, kitchen_note,
      confirmed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, 'COP', ?, 0, ?, '', ?, ?, ?)`,
    [
      order.id,
      `admin-finance-order-${runId}-${order.sequence}`,
      String(order.sequence).padStart(64, "0"),
      `${sessionPrefix}-${order.sequence}`,
      storeId,
      order.paymentMethod,
      order.orderStatus,
      order.operationalStatus,
      order.paymentStatus,
      order.totalCop,
      order.totalCop,
      order.confirmedAt,
      order.createdAt,
      order.createdAt,
    ],
  );

  for (const [position, line] of order.lines.entries()) {
    await pool.execute(
      `INSERT INTO order_lines (
        id, order_id, line_position, product_id, product_name,
        quantity, unit_base_price_cop, unit_price_cop, line_total_cop
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        order.id,
        position + 1,
        line.productId,
        line.productName,
        line.quantity,
        Math.floor(line.lineTotalCop / line.quantity),
        Math.floor(line.lineTotalCop / line.quantity),
        line.lineTotalCop,
      ],
    );
  }

  if (order.attemptStatus) {
    await pool.execute(
      `INSERT INTO payment_attempts (
        id, order_id, attempt_number, request_idempotency_key,
        request_fingerprint_sha256, status, completed_at, expired_at,
        created_at, updated_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        order.id,
        `admin-finance-attempt-${runId}-${order.sequence}`,
        String(order.sequence + 10).padStart(64, "0"),
        order.attemptStatus,
        order.completedAt ?? null,
        order.expiredAt ?? null,
        order.createdAt,
        order.expiredAt ?? order.completedAt ?? order.createdAt,
      ],
    );
  }
}

before(async () => {
  for (const order of orders) await seedOrder(order);
});

after(async () => {
  await getMySqlPool().execute(
    "DELETE FROM orders WHERE client_session_id LIKE ?",
    [`${sessionPrefix}%`],
  );
  await closeMySqlPool();
});

test("calcula ventas pagadas, pedidos confirmados, variación, serie y ranking", async () => {
  const snapshot = await getAdministratorFinancialSnapshot({ now, storeId });

  assert.equal(snapshot.summary.paidSalesCop, 50_000);
  assert.equal(snapshot.summary.paidOrderCount, 2);
  assert.equal(snapshot.summary.confirmedOrderCount, 3);
  assert.equal(snapshot.summary.averageTicketCop, 25_000);
  assert.equal(snapshot.summary.previousPaidSalesCop, 10_000);
  assert.equal(snapshot.summary.salesVariationPercent, 400);
  assert.equal(snapshot.salesSeries[5]?.salesCop, 50_000);
  assert.equal(snapshot.salesSeries[5]?.orderCount, 2);
  assert.deepEqual(snapshot.topProducts.slice(0, 2), [
    {
      productId: "la-bendita",
      productName: "La Bendita",
      quantitySold: 3,
      salesCop: 40_000,
    },
    {
      productId: "doble-pecado",
      productName: "Doble Pecado",
      quantitySold: 1,
      salesCop: 10_000,
    },
  ]);
});

test("pagina y filtra transacciones sin sumar pagos pendientes ni duplicar intentos", async () => {
  const firstPage = await getAdministratorTransactions({
    now,
    storeId,
    page: 1,
    pageSize: 2,
  });
  const secondPage = await getAdministratorTransactions({
    now,
    storeId,
    page: 2,
    pageSize: 2,
  });

  assert.equal(firstPage.totalItems, 5);
  assert.equal(firstPage.totalPages, 3);
  assert.equal(firstPage.paidTotalCop, 50_000);
  assert.deepEqual(
    firstPage.items.map((item) => item.orderId),
    [orderIds.stripeExpired, orderIds.cashPending],
  );
  assert.equal(secondPage.items[0]?.orderId, orderIds.stripePending);

  const equalTimestampIds = [orderIds.paidA, orderIds.paidB].sort().reverse();

  const paidStripe = await getAdministratorTransactions({
    now,
    storeId,
    paymentMethod: "stripe",
    paymentStatus: "pagado",
  });
  assert.equal(paidStripe.totalItems, 2);
  assert.equal(paidStripe.filteredPaidTotalCop, 50_000);
  assert.ok(paidStripe.items.every((item) => item.paymentStatus === "pagado"));
  assert.deepEqual(
    paidStripe.items.map((item) => item.orderId),
    equalTimestampIds,
  );

  const searched = await getAdministratorTransactions({
    now,
    storeId,
    search: paidStripe.items[0]?.orderCode,
  });
  assert.equal(searched.totalItems, 1);
  assert.equal(searched.items[0]?.orderCode, paidStripe.items[0]?.orderCode);
});

test("devuelve contratos vacíos y evita división entre cero fuera del período", async () => {
  const emptyNow = new Date("2035-01-10T16:30:00.000Z");
  const snapshot = await getAdministratorFinancialSnapshot({
    now: emptyNow,
    storeId,
  });
  const transactions = await getAdministratorTransactions({
    now: emptyNow,
    storeId,
  });

  assert.deepEqual(snapshot.summary, {
    paidSalesCop: 0,
    paidOrderCount: 0,
    confirmedOrderCount: 0,
    averageTicketCop: 0,
    previousPaidSalesCop: 0,
    salesVariationPercent: null,
  });
  assert.ok(snapshot.salesSeries.every((point) => point.salesCop === 0));
  assert.deepEqual(snapshot.topProducts, []);
  assert.equal(transactions.totalItems, 0);
  assert.equal(transactions.totalPages, 0);
  assert.equal(transactions.paidTotalCop, 0);
  assert.deepEqual(transactions.items, []);
});
