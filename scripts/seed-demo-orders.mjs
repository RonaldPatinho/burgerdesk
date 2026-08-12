import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const SERVICE_FEE_COP = 2_900;

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_MISSING");
  }

  return databaseUrl;
}

function safeErrorCode(error) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "UNKNOWN";
  }

  return typeof error.code === "string" ? error.code : "UNKNOWN";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000);
}

function buildHistory(orderId, status, startedAt) {
  const sequence = [
    "recibido",
    "en_preparacion",
    "listo_para_retirar",
  ];

  const endIndex = sequence.indexOf(status);
  if (endIndex === -1) {
    throw new Error(`INVALID_SEED_STATUS:${status}`);
  }

  const entries = [];
  let previous = null;

  for (let index = 0; index <= endIndex; index += 1) {
    entries.push({
      id: randomUUID(),
      orderId,
      previousStatus: previous,
      newStatus: sequence[index],
      changedAt: new Date(
        startedAt.getTime() + (index * 2 + 1) * 60_000,
      ),
    });
    previous = sequence[index];
  }

  return entries;
}

const DEMO_ORDERS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    operationalStatus: "recibido",
    paymentMethod: "stripe",
    paymentStatus: "pagado",
    kitchenNote: "",
    startedMinutesAgo: 6,
    lines: [
      {
        productId: "la-bendita",
        productName: "La Bendita",
        quantity: 1,
        unitBasePriceCop: 26_900,
        unitPriceCop: 26_900,
        options: [
          { optionId: "cheddar-extra", optionName: "Cheddar extra", priceCop: 3_500 },
          { optionId: "tocineta", optionName: "Tocineta", priceCop: 4_500 },
        ],
      },
      {
        productId: "papas-cheddar",
        productName: "Papas cheddar",
        quantity: 1,
        unitBasePriceCop: 12_900,
        unitPriceCop: 12_900,
        options: [],
      },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    operationalStatus: "recibido",
    paymentMethod: "efectivo",
    paymentStatus: "pendiente_en_efectivo",
    kitchenNote: "Sin aderezos",
    startedMinutesAgo: 4,
    lines: [
      {
        productId: "santa-pollo",
        productName: "Santa Pollo",
        quantity: 2,
        unitBasePriceCop: 28_900,
        unitPriceCop: 28_900,
        options: [],
      },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    operationalStatus: "en_preparacion",
    paymentMethod: "stripe",
    paymentStatus: "pagado",
    kitchenNote: "",
    startedMinutesAgo: 15,
    lines: [
      {
        productId: "doble-pecado",
        productName: "Doble Pecado",
        quantity: 1,
        unitBasePriceCop: 34_900,
        unitPriceCop: 34_900,
        options: [
          { optionId: "cheddar-extra", optionName: "Cheddar extra", priceCop: 3_500 },
        ],
      },
      {
        productId: "bacon-bendita",
        productName: "Bacon Bendita",
        quantity: 1,
        unitBasePriceCop: 34_900,
        unitPriceCop: 34_900,
        options: [],
      },
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    operationalStatus: "en_preparacion",
    paymentMethod: "efectivo",
    paymentStatus: "pendiente_en_efectivo",
    kitchenNote: "Extra salsas aparte",
    startedMinutesAgo: 12,
    lines: [
      {
        productId: "combo-gloria",
        productName: "Combo Gloria",
        quantity: 1,
        unitBasePriceCop: 41_900,
        unitPriceCop: 41_900,
        options: [],
      },
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    operationalStatus: "listo_para_retirar",
    paymentMethod: "stripe",
    paymentStatus: "pagado",
    kitchenNote: "",
    startedMinutesAgo: 25,
    lines: [
      {
        productId: "la-bendita",
        productName: "La Bendita",
        quantity: 1,
        unitBasePriceCop: 26_900,
        unitPriceCop: 26_900,
        options: [
          { optionId: "tocineta", optionName: "Tocineta", priceCop: 4_500 },
          { optionId: "cebolla", optionName: "Cebolla", priceCop: 2_500 },
        ],
      },
      {
        productId: "papas-cheddar",
        productName: "Papas cheddar",
        quantity: 2,
        unitBasePriceCop: 12_900,
        unitPriceCop: 12_900,
        options: [],
      },
    ],
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    operationalStatus: "listo_para_retirar",
    paymentMethod: "stripe",
    paymentStatus: "pagado",
    kitchenNote: "Pedido para recoger a las 7pm",
    startedMinutesAgo: 20,
    lines: [
      {
        productId: "bacon-bendita",
        productName: "Bacon Bendita",
        quantity: 1,
        unitBasePriceCop: 34_900,
        unitPriceCop: 34_900,
        options: [
          { optionId: "cheddar-extra", optionName: "Cheddar extra", priceCop: 3_500 },
        ],
      },
    ],
  },
];

function buildOrderInsert(order, startedAt) {
  const lineInserts = [];
  const optionInserts = [];

  let subtotalCop = 0;

  order.lines.forEach((line, lineIndex) => {
    const lineId = randomUUID();
    const lineOptionsTotalCop = line.options.reduce(
      (sum, option) => sum + option.priceCop,
      0,
    );
    const unitPriceCop = line.unitPriceCop + lineOptionsTotalCop;
    const lineTotalCop = unitPriceCop * line.quantity;
    subtotalCop += lineTotalCop;

    lineInserts.push({
      id: lineId,
      orderId: order.id,
      linePosition: lineIndex + 1,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitBasePriceCop: line.unitBasePriceCop,
      unitPriceCop,
      lineTotalCop,
      createdAt: startedAt,
    });

    line.options.forEach((option, optionIndex) => {
      optionInserts.push({
        id: randomUUID(),
        orderLineId: lineId,
        optionPosition: optionIndex + 1,
        optionId: option.optionId,
        optionName: option.optionName,
        priceCop: option.priceCop,
        createdAt: startedAt,
      });
    });
  });

  const historyInserts = buildHistory(
    order.id,
    order.operationalStatus,
    startedAt,
  );

  return {
    order: {
      id: order.id,
      creationIdempotencyKey: `seed-demo-${order.id}`,
      requestFingerprintSha256: sha256(order.id),
      clientSessionId: "seed-demo-session",
      clientId: null,
      storeId: "sede-centro",
      paymentMethod: order.paymentMethod,
      orderStatus: "confirmado",
      operationalStatus: order.operationalStatus,
      paymentStatus: order.paymentStatus,
      currency: "COP",
      subtotalCop,
      serviceFeeCop: SERVICE_FEE_COP,
      totalCop: subtotalCop + SERVICE_FEE_COP,
      kitchenNote: order.kitchenNote,
      confirmedAt: startedAt,
      createdAt: startedAt,
    },
    lineInserts,
    optionInserts,
    historyInserts,
  };
}

async function seedDemoOrders() {
  const connection = await mysql.createConnection(requireDatabaseUrl());

  try {
    let inserted = 0;
    let skipped = 0;

    for (const demoOrder of DEMO_ORDERS) {
      const startedAt = minutesAgo(demoOrder.startedMinutesAgo);
      const built = buildOrderInsert(demoOrder, startedAt);

      await connection.beginTransaction();
      try {
        const [existingRows] = await connection.execute(
          "SELECT id FROM orders WHERE id = ?",
          [demoOrder.id],
        );
        if (existingRows[0]) {
          skipped += 1;
          await connection.rollback();
          continue;
        }

        await connection.execute(
          `INSERT INTO orders (
            id, creation_idempotency_key, request_fingerprint_sha256,
            client_session_id, client_id, store_id, payment_method,
            order_status, operational_status, payment_status, currency,
            subtotal_cop, service_fee_cop, total_cop, kitchen_note,
            confirmed_at, created_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )`,
          [
            built.order.id,
            built.order.creationIdempotencyKey,
            built.order.requestFingerprintSha256,
            built.order.clientSessionId,
            built.order.clientId,
            built.order.storeId,
            built.order.paymentMethod,
            built.order.orderStatus,
            built.order.operationalStatus,
            built.order.paymentStatus,
            built.order.currency,
            built.order.subtotalCop,
            built.order.serviceFeeCop,
            built.order.totalCop,
            built.order.kitchenNote,
            built.order.confirmedAt,
            built.order.createdAt,
          ],
        );

        for (const line of built.lineInserts) {
          await connection.execute(
            `INSERT INTO order_lines (
              id, order_id, line_position, product_id, product_name,
              quantity, unit_base_price_cop, unit_price_cop,
              line_total_cop, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              line.id,
              line.orderId,
              line.linePosition,
              line.productId,
              line.productName,
              line.quantity,
              line.unitBasePriceCop,
              line.unitPriceCop,
              line.lineTotalCop,
              line.createdAt,
            ],
          );
        }

        for (const option of built.optionInserts) {
          await connection.execute(
            `INSERT INTO order_line_options (
              id, order_line_id, option_position, option_id,
              option_name, price_cop, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              option.id,
              option.orderLineId,
              option.optionPosition,
              option.optionId,
              option.optionName,
              option.priceCop,
              option.createdAt,
            ],
          );
        }

        for (const history of built.historyInserts) {
          await connection.execute(
            `INSERT INTO order_status_history (
              id, order_id, previous_status, new_status,
              changed_by_user_id, change_source, changed_at
            ) VALUES (?, ?, ?, ?, NULL, 'migration', ?)`,
            [
              history.id,
              history.orderId,
              history.previousStatus,
              history.newStatus,
              history.changedAt,
            ],
          );
        }

        await connection.commit();
        inserted += 1;
        console.log(`Pedido de ejemplo insertado: ${demoOrder.id} (${demoOrder.operationalStatus})`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    console.log(
      `Seed completado: ${inserted} insertados, ${skipped} ya existían.`,
    );
  } finally {
    await connection.end();
  }
}

seedDemoOrders().catch((error) => {
  console.error(`No se pudo sembrar la bandeja (${safeErrorCode(error)}).`);
  process.exitCode = 1;
});
