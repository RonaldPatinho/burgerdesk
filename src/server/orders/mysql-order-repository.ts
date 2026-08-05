import { createHash, randomUUID } from "node:crypto";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import {
  getMySqlPool,
  hasMySqlErrorCode,
  withMySqlTransaction,
} from "../database/mysql";
import type {
  CreatedInternalOrder,
  InternalOrderStatus,
  InternalPaymentStatus,
  PaymentAttemptRecord,
  PaymentAttemptStatus,
  PersistedOrder,
  PersistedOrderLine,
  PersistedOrderOption,
  RecalculatedOrderDraft,
  RecalculatedOrderLineDraft,
  ServerPaymentMethod,
  StripeWebhookEventData,
  StripeWebhookProcessingResult,
  StripeWebhookSessionData,
} from "./types";
import { stripeMinorUnitsToWholeCop } from "../stripe/money";

interface OrderRow extends RowDataPacket {
  id: string;
  creation_idempotency_key: string;
  request_fingerprint_sha256: string;
  client_session_id: string;
  client_id: string | null;
  user_id: string | null;
  store_id: string;
  payment_method: ServerPaymentMethod;
  order_status: InternalOrderStatus;
  payment_status: InternalPaymentStatus;
  currency: "COP";
  subtotal_cop: number | string;
  service_fee_cop: number | string;
  total_cop: number | string;
  kitchen_note: string;
  confirmed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface OrderLineRow extends RowDataPacket {
  id: string;
  order_id: string;
  line_position: number;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_base_price_cop: number | string;
  unit_price_cop: number | string;
  line_total_cop: number | string;
}

interface OrderOptionRow extends RowDataPacket {
  id: string;
  order_line_id: string;
  option_position: number;
  option_id: string;
  option_name: string;
  price_cop: number | string;
}

interface PaymentAttemptRow extends RowDataPacket {
  id: string;
  order_id: string;
  attempt_number: number;
  request_idempotency_key: string;
  request_fingerprint_sha256: string;
  status: PaymentAttemptStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AttemptWithOrderRow extends PaymentAttemptRow {
  order_payment_method: ServerPaymentMethod;
  order_status: InternalOrderStatus;
  order_payment_status: InternalPaymentStatus;
  order_total_cop: number | string;
  order_currency: "COP";
}

export class OrderPersistenceError extends Error {
  constructor(
    public readonly code:
      | "INVALID_RECALCULATED_ORDER"
      | "IDEMPOTENCY_KEY_REUSED"
      | "ORDER_NOT_FOUND"
      | "ORDER_ALREADY_CONFIRMED"
      | "PAYMENT_ATTEMPT_NOT_FOUND"
      | "PAYMENT_ATTEMPT_NOT_PENDING"
      | "STRIPE_SESSION_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "OrderPersistenceError";
  }
}

function assertIdentifier(value: string, fieldName: string, maximum: number): void {
  if (!value.trim() || value.length > maximum) {
    throw new OrderPersistenceError(
      "INVALID_RECALCULATED_ORDER",
      `${fieldName} no es valido.`,
    );
  }
}

function assertCopAmount(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new OrderPersistenceError(
      "INVALID_RECALCULATED_ORDER",
      `${fieldName} debe ser un entero COP no negativo.`,
    );
  }
}

function assertRecalculatedLine(line: RecalculatedOrderLineDraft): void {
  assertIdentifier(line.productId, "productId", 64);
  assertIdentifier(line.productName, "productName", 191);
  assertCopAmount(line.unitBasePriceCop, "unitBasePriceCop");
  assertCopAmount(line.unitPriceCop, "unitPriceCop");
  assertCopAmount(line.lineTotalCop, "lineTotalCop");

  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 65_535) {
    throw new OrderPersistenceError(
      "INVALID_RECALCULATED_ORDER",
      "La cantidad de una linea no es valida.",
    );
  }

  const optionsTotal = line.options.reduce((total, option) => {
    assertIdentifier(option.optionId, "optionId", 64);
    assertIdentifier(option.optionName, "optionName", 191);
    assertCopAmount(option.priceCop, "optionPriceCop");
    return total + option.priceCop;
  }, 0);

  if (
    line.unitPriceCop !== line.unitBasePriceCop + optionsTotal ||
    line.lineTotalCop !== line.unitPriceCop * line.quantity
  ) {
    throw new OrderPersistenceError(
      "INVALID_RECALCULATED_ORDER",
      "Los importes de una linea no coinciden con su configuracion.",
    );
  }
}

function assertRecalculatedOrder(draft: RecalculatedOrderDraft): void {
  assertIdentifier(draft.creationIdempotencyKey, "creationIdempotencyKey", 191);
  assertIdentifier(draft.clientSessionId, "clientSessionId", 191);
  if (draft.clientId !== null) {
    assertIdentifier(draft.clientId, "clientId", 191);
  }
  if (draft.userId !== null && draft.userId !== undefined) {
    assertIdentifier(draft.userId, "userId", 36);
  }
  assertIdentifier(draft.storeId, "storeId", 64);
  if (draft.paymentMethod === "stripe") {
    assertIdentifier(
      draft.paymentRequestIdempotencyKey,
      "paymentRequestIdempotencyKey",
      191,
    );
  }
  if (draft.lines.length < 1 || draft.lines.length > 65_535) {
    throw new OrderPersistenceError(
      "INVALID_RECALCULATED_ORDER",
      "El pedido debe contener al menos una linea.",
    );
  }

  draft.lines.forEach(assertRecalculatedLine);
  assertCopAmount(draft.subtotalCop, "subtotalCop");
  assertCopAmount(draft.serviceFeeCop, "serviceFeeCop");
  assertCopAmount(draft.totalCop, "totalCop");

  const calculatedSubtotal = draft.lines.reduce(
    (total, line) => total + line.lineTotalCop,
    0,
  );
  if (
    calculatedSubtotal !== draft.subtotalCop ||
    draft.totalCop !== draft.subtotalCop + draft.serviceFeeCop
  ) {
    throw new OrderPersistenceError(
      "INVALID_RECALCULATED_ORDER",
      "Los totales del pedido no coinciden con sus lineas.",
    );
  }
}

function sha256(value: object): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createOrderFingerprint(draft: RecalculatedOrderDraft): string {
  return sha256({
    clientSessionId: draft.clientSessionId,
    clientId: draft.clientId,
    userId: draft.userId ?? null,
    storeId: draft.storeId,
    paymentMethod: draft.paymentMethod,
    kitchenNote: draft.kitchenNote,
    subtotalCop: draft.subtotalCop,
    serviceFeeCop: draft.serviceFeeCop,
    totalCop: draft.totalCop,
    lines: draft.lines,
  });
}

function createAttemptFingerprint(orderId: string): string {
  return sha256({ orderId, purpose: "stripe_checkout_payment" });
}

function toSafeInteger(value: number | string, fieldName: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new OrderPersistenceError(
      "INVALID_RECALCULATED_ORDER",
      `${fieldName} no cabe en un entero seguro.`,
    );
  }
  return numberValue;
}

function toIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function mapAttempt(row: PaymentAttemptRow): PaymentAttemptRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function loadOrderById(
  connection: PoolConnection,
  orderId: string,
  lock = false,
): Promise<PersistedOrder | null> {
  const [orderRows] = await connection.execute<OrderRow[]>(
    `SELECT * FROM orders WHERE id = ?${lock ? " FOR UPDATE" : ""}`,
    [orderId],
  );
  const orderRow = orderRows[0];
  if (!orderRow) {
    return null;
  }

  const [lineRows] = await connection.execute<OrderLineRow[]>(
    "SELECT * FROM order_lines WHERE order_id = ? ORDER BY line_position",
    [orderId],
  );
  const lineIds = lineRows.map((line) => line.id);
  let optionRows: OrderOptionRow[] = [];
  if (lineIds.length > 0) {
    const placeholders = lineIds.map(() => "?").join(", ");
    const [rows] = await connection.execute<OrderOptionRow[]>(
      `SELECT * FROM order_line_options WHERE order_line_id IN (${placeholders}) ORDER BY option_position`,
      lineIds,
    );
    optionRows = rows;
  }
  const [attemptRows] = await connection.execute<PaymentAttemptRow[]>(
    "SELECT * FROM payment_attempts WHERE order_id = ? ORDER BY attempt_number",
    [orderId],
  );

  const optionsByLine = new Map<string, PersistedOrderOption[]>();
  for (const option of optionRows) {
    const mappedOption: PersistedOrderOption = {
      id: option.id,
      optionId: option.option_id,
      optionName: option.option_name,
      priceCop: toSafeInteger(option.price_cop, "price_cop"),
    };
    const existing = optionsByLine.get(option.order_line_id) ?? [];
    existing.push(mappedOption);
    optionsByLine.set(option.order_line_id, existing);
  }

  const lines: PersistedOrderLine[] = lineRows.map((line) => ({
    id: line.id,
    productId: line.product_id,
    productName: line.product_name,
    quantity: line.quantity,
    unitBasePriceCop: toSafeInteger(line.unit_base_price_cop, "unit_base_price_cop"),
    unitPriceCop: toSafeInteger(line.unit_price_cop, "unit_price_cop"),
    lineTotalCop: toSafeInteger(line.line_total_cop, "line_total_cop"),
    options: optionsByLine.get(line.id) ?? [],
  }));

  return {
    id: orderRow.id,
    clientSessionId: orderRow.client_session_id,
    clientId: orderRow.client_id,
    userId: orderRow.user_id,
    storeId: orderRow.store_id,
    paymentMethod: orderRow.payment_method,
    orderStatus: orderRow.order_status,
    paymentStatus: orderRow.payment_status,
    currency: orderRow.currency,
    subtotalCop: toSafeInteger(orderRow.subtotal_cop, "subtotal_cop"),
    serviceFeeCop: toSafeInteger(orderRow.service_fee_cop, "service_fee_cop"),
    totalCop: toSafeInteger(orderRow.total_cop, "total_cop"),
    kitchenNote: orderRow.kitchen_note,
    confirmedAt: toIsoString(orderRow.confirmed_at),
    createdAt: orderRow.created_at.toISOString(),
    updatedAt: orderRow.updated_at.toISOString(),
    lines,
    paymentAttempts: attemptRows.map(mapAttempt),
  };
}

async function findOrderByCreationKey(
  connection: PoolConnection,
  creationKey: string,
): Promise<OrderRow | null> {
  const [rows] = await connection.execute<OrderRow[]>(
    "SELECT * FROM orders WHERE creation_idempotency_key = ?",
    [creationKey],
  );
  return rows[0] ?? null;
}

function assertMatchingFingerprint(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new OrderPersistenceError(
      "IDEMPOTENCY_KEY_REUSED",
      "La clave idempotente ya fue usada con otro contenido.",
    );
  }
}

async function insertPaymentAttempt(
  connection: PoolConnection,
  orderId: string,
  attemptNumber: number,
  requestIdempotencyKey: string,
): Promise<string> {
  const attemptId = randomUUID();
  await connection.execute<ResultSetHeader>(
    `INSERT INTO payment_attempts (
      id, order_id, attempt_number, request_idempotency_key,
      request_fingerprint_sha256, status
    ) VALUES (?, ?, ?, ?, ?, 'pendiente')`,
    [
      attemptId,
      orderId,
      attemptNumber,
      requestIdempotencyKey,
      createAttemptFingerprint(orderId),
    ],
  );
  return attemptId;
}

async function createOrderInTransaction(
  connection: PoolConnection,
  draft: RecalculatedOrderDraft,
  fingerprint: string,
): Promise<CreatedInternalOrder> {
  const existing = await findOrderByCreationKey(
    connection,
    draft.creationIdempotencyKey,
  );
  if (existing) {
    assertMatchingFingerprint(existing.request_fingerprint_sha256, fingerprint);
    const order = await loadOrderById(connection, existing.id);
    if (!order) {
      throw new OrderPersistenceError("ORDER_NOT_FOUND", "El pedido no existe.");
    }
    return {
      order,
      paymentAttempt: order.paymentAttempts[0] ?? null,
      reused: true,
    };
  }

  const orderId = randomUUID();
  const isStripe = draft.paymentMethod === "stripe";
  await connection.execute<ResultSetHeader>(
    `INSERT INTO orders (
      id, creation_idempotency_key, request_fingerprint_sha256,
      client_session_id, client_id, user_id, store_id, payment_method,
      order_status, payment_status, currency, subtotal_cop,
      service_fee_cop, total_cop, kitchen_note, confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COP', ?, ?, ?, ?, ?)`,
    [
      orderId,
      draft.creationIdempotencyKey,
      fingerprint,
      draft.clientSessionId,
      draft.clientId,
      draft.userId ?? null,
      draft.storeId,
      draft.paymentMethod,
      isStripe ? "pendiente_de_pago" : "confirmado",
      isStripe ? "pendiente" : "pendiente_en_efectivo",
      draft.subtotalCop,
      draft.serviceFeeCop,
      draft.totalCop,
      draft.kitchenNote,
      isStripe ? null : new Date(),
    ],
  );

  for (const [lineIndex, line] of draft.lines.entries()) {
    const lineId = randomUUID();
    await connection.execute<ResultSetHeader>(
      `INSERT INTO order_lines (
        id, order_id, line_position, product_id, product_name, quantity,
        unit_base_price_cop, unit_price_cop, line_total_cop
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lineId,
        orderId,
        lineIndex + 1,
        line.productId,
        line.productName,
        line.quantity,
        line.unitBasePriceCop,
        line.unitPriceCop,
        line.lineTotalCop,
      ],
    );
    for (const [optionIndex, option] of line.options.entries()) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO order_line_options (
          id, order_line_id, option_position, option_id, option_name, price_cop
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          lineId,
          optionIndex + 1,
          option.optionId,
          option.optionName,
          option.priceCop,
        ],
      );
    }
  }

  let paymentAttemptId: string | null = null;
  if (draft.paymentMethod === "stripe") {
    paymentAttemptId = await insertPaymentAttempt(
      connection,
      orderId,
      1,
      draft.paymentRequestIdempotencyKey,
    );
  }

  const order = await loadOrderById(connection, orderId);
  if (!order) {
    throw new OrderPersistenceError("ORDER_NOT_FOUND", "El pedido no existe.");
  }
  return {
    order,
    paymentAttempt:
      paymentAttemptId === null
        ? null
        : order.paymentAttempts.find((attempt) => attempt.id === paymentAttemptId) ?? null,
    reused: false,
  };
}

export async function createInternalOrder(
  draft: RecalculatedOrderDraft,
): Promise<CreatedInternalOrder> {
  assertRecalculatedOrder(draft);
  const fingerprint = createOrderFingerprint(draft);

  try {
    return await withMySqlTransaction((connection) =>
      createOrderInTransaction(connection, draft, fingerprint),
    );
  } catch (error) {
    if (!hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw error;
    }

    const connection = await getMySqlPool().getConnection();
    try {
      const existing = await findOrderByCreationKey(
        connection,
        draft.creationIdempotencyKey,
      );
      if (!existing) {
        throw new OrderPersistenceError(
          "IDEMPOTENCY_KEY_REUSED",
          "Una clave idempotente de pago ya pertenece a otro pedido.",
        );
      }
      assertMatchingFingerprint(existing.request_fingerprint_sha256, fingerprint);
      const order = await loadOrderById(connection, existing.id);
      if (!order) {
        throw new OrderPersistenceError("ORDER_NOT_FOUND", "El pedido no existe.");
      }
      return {
        order,
        paymentAttempt: order.paymentAttempts[0] ?? null,
        reused: true,
      };
    } finally {
      connection.release();
    }
  }
}

export async function getInternalOrderById(
  orderId: string,
): Promise<PersistedOrder | null> {
  const connection = await getMySqlPool().getConnection();
  try {
    return await loadOrderById(connection, orderId);
  } finally {
    connection.release();
  }
}

export async function getInternalOrderByCheckoutSessionId(
  stripeCheckoutSessionId: string,
): Promise<PersistedOrder | null> {
  assertIdentifier(
    stripeCheckoutSessionId,
    "stripeCheckoutSessionId",
    255,
  );
  const connection = await getMySqlPool().getConnection();
  try {
    const [rows] = await connection.execute<
      (RowDataPacket & { order_id: string })[]
    >(
      "SELECT order_id FROM payment_attempts WHERE stripe_checkout_session_id = ?",
      [stripeCheckoutSessionId],
    );
    const orderId = rows[0]?.order_id;
    return orderId ? loadOrderById(connection, orderId) : null;
  } finally {
    connection.release();
  }
}

export async function createRetryPaymentAttempt(
  orderId: string,
  requestIdempotencyKey: string,
): Promise<{ attempt: PaymentAttemptRecord; reused: boolean }> {
  assertIdentifier(orderId, "orderId", 36);
  assertIdentifier(requestIdempotencyKey, "requestIdempotencyKey", 191);
  const fingerprint = createAttemptFingerprint(orderId);

  try {
    return await withMySqlTransaction(async (connection) => {
      const [existingRows] = await connection.execute<PaymentAttemptRow[]>(
        "SELECT * FROM payment_attempts WHERE request_idempotency_key = ? FOR UPDATE",
        [requestIdempotencyKey],
      );
      const existing = existingRows[0];
      if (existing) {
        assertMatchingFingerprint(existing.request_fingerprint_sha256, fingerprint);
        return { attempt: mapAttempt(existing), reused: true };
      }

      const [orderRows] = await connection.execute<OrderRow[]>(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [orderId],
      );
      const order = orderRows[0];
      if (!order) {
        throw new OrderPersistenceError("ORDER_NOT_FOUND", "El pedido no existe.");
      }
      if (order.payment_method !== "stripe") {
        throw new OrderPersistenceError(
          "PAYMENT_ATTEMPT_NOT_PENDING",
          "El pedido no usa Stripe.",
        );
      }
      if (order.payment_status === "pagado" || order.order_status === "confirmado") {
        throw new OrderPersistenceError(
          "ORDER_ALREADY_CONFIRMED",
          "El pedido ya esta confirmado.",
        );
      }

      const [numberRows] = await connection.execute<
        (RowDataPacket & { next_attempt: number })[]
      >(
        "SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt FROM payment_attempts WHERE order_id = ?",
        [orderId],
      );
      const attemptId = await insertPaymentAttempt(
        connection,
        orderId,
        numberRows[0]?.next_attempt ?? 1,
        requestIdempotencyKey,
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE orders
         SET order_status = 'pendiente_de_pago', payment_status = 'pendiente'
         WHERE id = ?`,
        [orderId],
      );
      const [attemptRows] = await connection.execute<PaymentAttemptRow[]>(
        "SELECT * FROM payment_attempts WHERE id = ?",
        [attemptId],
      );
      const attempt = attemptRows[0];
      if (!attempt) {
        throw new OrderPersistenceError(
          "PAYMENT_ATTEMPT_NOT_FOUND",
          "El intento de pago no existe.",
        );
      }
      return { attempt: mapAttempt(attempt), reused: false };
    });
  } catch (error) {
    if (!hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw error;
    }
    const connection = await getMySqlPool().getConnection();
    try {
      const [rows] = await connection.execute<PaymentAttemptRow[]>(
        "SELECT * FROM payment_attempts WHERE request_idempotency_key = ?",
        [requestIdempotencyKey],
      );
      const attempt = rows[0];
      if (!attempt) {
        throw error;
      }
      assertMatchingFingerprint(attempt.request_fingerprint_sha256, fingerprint);
      return { attempt: mapAttempt(attempt), reused: true };
    } finally {
      connection.release();
    }
  }
}

export async function attachStripeCheckoutSession(input: {
  orderId: string;
  paymentAttemptId: string;
  stripeCheckoutSessionId: string;
}): Promise<void> {
  assertIdentifier(input.orderId, "orderId", 36);
  assertIdentifier(input.paymentAttemptId, "paymentAttemptId", 36);
  assertIdentifier(input.stripeCheckoutSessionId, "stripeCheckoutSessionId", 255);

  await withMySqlTransaction(async (connection) => {
    const [rows] = await connection.execute<PaymentAttemptRow[]>(
      "SELECT * FROM payment_attempts WHERE id = ? AND order_id = ? FOR UPDATE",
      [input.paymentAttemptId, input.orderId],
    );
    const attempt = rows[0];
    if (!attempt) {
      throw new OrderPersistenceError(
        "PAYMENT_ATTEMPT_NOT_FOUND",
        "El intento de pago no existe.",
      );
    }
    if (attempt.status !== "pendiente") {
      throw new OrderPersistenceError(
        "PAYMENT_ATTEMPT_NOT_PENDING",
        "El intento de pago ya no esta pendiente.",
      );
    }
    if (
      attempt.stripe_checkout_session_id !== null &&
      attempt.stripe_checkout_session_id !== input.stripeCheckoutSessionId
    ) {
      throw new OrderPersistenceError(
        "STRIPE_SESSION_CONFLICT",
        "El intento ya tiene otra sesion de Stripe.",
      );
    }
    await connection.execute<ResultSetHeader>(
      `UPDATE payment_attempts
       SET stripe_checkout_session_id = ?
       WHERE id = ? AND order_id = ?`,
      [input.stripeCheckoutSessionId, input.paymentAttemptId, input.orderId],
    );
  });
}

async function findAndLockAttemptForSession(
  connection: PoolConnection,
  session: StripeWebhookSessionData,
): Promise<AttemptWithOrderRow | null> {
  const metadataAttemptId = session.metadataPaymentAttemptId;
  const [rows] = await connection.execute<AttemptWithOrderRow[]>(
    `SELECT pa.*,
      o.payment_method AS order_payment_method,
      o.order_status,
      o.payment_status AS order_payment_status,
      o.total_cop AS order_total_cop,
      o.currency AS order_currency
     FROM payment_attempts pa
     INNER JOIN orders o ON o.id = pa.order_id
     WHERE pa.stripe_checkout_session_id = ?
        OR (? IS NOT NULL AND pa.id = ?)
     FOR UPDATE`,
    [session.id, metadataAttemptId, metadataAttemptId],
  );
  if (rows.length !== 1) {
    return null;
  }
  return rows[0] ?? null;
}

function sessionReferencesOrder(
  session: StripeWebhookSessionData,
  attempt: AttemptWithOrderRow,
): boolean {
  const suppliedOrderIds = [
    session.clientReferenceId,
    session.metadataOrderId,
  ].filter((value): value is string => value !== null);
  return (
    suppliedOrderIds.length > 0 &&
    suppliedOrderIds.every((orderId) => orderId === attempt.order_id) &&
    (session.metadataPaymentAttemptId === null ||
      session.metadataPaymentAttemptId === attempt.id) &&
    attempt.order_payment_method === "stripe"
  );
}

async function associateSessionWithAttempt(
  connection: PoolConnection,
  session: StripeWebhookSessionData,
  attempt: AttemptWithOrderRow,
): Promise<boolean> {
  if (
    attempt.stripe_checkout_session_id !== null &&
    attempt.stripe_checkout_session_id !== session.id
  ) {
    return false;
  }
  if (attempt.stripe_checkout_session_id === null) {
    await connection.execute<ResultSetHeader>(
      "UPDATE payment_attempts SET stripe_checkout_session_id = ? WHERE id = ?",
      [session.id, attempt.id],
    );
  }
  return true;
}

function isPaidEvent(eventType: string): boolean {
  return (
    eventType === "checkout.session.completed" ||
    eventType === "checkout.session.async_payment_succeeded"
  );
}

function isTerminalFailureEvent(eventType: string): boolean {
  return (
    eventType === "checkout.session.expired" ||
    eventType === "checkout.session.async_payment_failed"
  );
}

async function finishWebhookEvent(
  connection: PoolConnection,
  eventId: string,
  outcome: "procesado" | "ignorado",
  orderId: string | null,
  attemptId: string | null,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `UPDATE stripe_webhook_events
     SET processing_status = ?, order_id = ?, payment_attempt_id = ?,
         processed_at = CURRENT_TIMESTAMP(3)
     WHERE stripe_event_id = ?`,
    [outcome, orderId, attemptId, eventId],
  );
}

export async function processStripeWebhookEventInTransaction(
  connection: PoolConnection,
  event: StripeWebhookEventData,
): Promise<StripeWebhookProcessingResult> {
  try {
    await connection.execute<ResultSetHeader>(
      `INSERT INTO stripe_webhook_events (
        stripe_event_id, event_type, stripe_object_id,
        processing_status, event_created_at
      ) VALUES (?, ?, ?, 'procesando', ?)`,
      [
        event.eventId,
        event.eventType,
        event.session?.id ?? null,
        event.eventCreatedAt,
      ],
    );
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      return { duplicate: true, outcome: "ignorado", orderId: null };
    }
    throw error;
  }

  const session = event.session;
  if (
    !session ||
    session.mode !== "payment" ||
    (!isPaidEvent(event.eventType) && !isTerminalFailureEvent(event.eventType))
  ) {
    await finishWebhookEvent(connection, event.eventId, "ignorado", null, null);
    return { duplicate: false, outcome: "ignorado", orderId: null };
  }

  const attempt = await findAndLockAttemptForSession(connection, session);
  if (
    !attempt ||
    !sessionReferencesOrder(session, attempt) ||
    !(await associateSessionWithAttempt(connection, session, attempt))
  ) {
    await finishWebhookEvent(connection, event.eventId, "ignorado", null, null);
    return { duplicate: false, outcome: "ignorado", orderId: null };
  }

  if (isPaidEvent(event.eventType)) {
    if (session.paymentStatus !== "paid") {
      if (event.eventType === "checkout.session.completed") {
        await finishWebhookEvent(
          connection,
          event.eventId,
          "procesado",
          attempt.order_id,
          attempt.id,
        );
        return {
          duplicate: false,
          outcome: "procesado",
          orderId: attempt.order_id,
        };
      }
      await finishWebhookEvent(
        connection,
        event.eventId,
        "ignorado",
        attempt.order_id,
        attempt.id,
      );
      return { duplicate: false, outcome: "ignorado", orderId: attempt.order_id };
    }

    if (
      session.currency?.toUpperCase() !== attempt.order_currency ||
      stripeMinorUnitsToWholeCop(session.amountTotalMinor) !==
        toSafeInteger(attempt.order_total_cop, "total_cop")
    ) {
      await finishWebhookEvent(
        connection,
        event.eventId,
        "ignorado",
        attempt.order_id,
        attempt.id,
      );
      return { duplicate: false, outcome: "ignorado", orderId: attempt.order_id };
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE payment_attempts
       SET status = 'pagado',
           stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?),
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP(3))
       WHERE id = ?`,
      [session.paymentIntentId, attempt.id],
    );
    await connection.execute<ResultSetHeader>(
      `UPDATE orders
       SET order_status = 'confirmado', payment_status = 'pagado',
           confirmed_at = COALESCE(confirmed_at, CURRENT_TIMESTAMP(3))
       WHERE id = ?`,
      [attempt.order_id],
    );
  } else if (attempt.status !== "pagado" && attempt.order_payment_status !== "pagado") {
    const attemptStatus =
      event.eventType === "checkout.session.expired" ? "expirado" : "fallido";
    const timestampColumn = attemptStatus === "expirado" ? "expired_at" : "failed_at";
    await connection.query(
      `UPDATE payment_attempts
       SET status = ?, ${timestampColumn} = COALESCE(${timestampColumn}, CURRENT_TIMESTAMP(3))
       WHERE id = ? AND status <> 'pagado'`,
      [attemptStatus, attempt.id],
    );
    await connection.execute<ResultSetHeader>(
      `UPDATE orders
       SET payment_status = ?
       WHERE id = ?
         AND payment_status <> 'pagado'
         AND NOT EXISTS (
           SELECT 1 FROM payment_attempts newer
           WHERE newer.order_id = orders.id
             AND newer.attempt_number > ?
         )`,
      [attemptStatus, attempt.order_id, attempt.attempt_number],
    );
  }

  await finishWebhookEvent(
    connection,
    event.eventId,
    "procesado",
    attempt.order_id,
    attempt.id,
  );
  return {
    duplicate: false,
    outcome: "procesado",
    orderId: attempt.order_id,
  };
}

export async function processStripeWebhookEvent(
  event: StripeWebhookEventData,
): Promise<StripeWebhookProcessingResult> {
  return withMySqlTransaction((connection) =>
    processStripeWebhookEventInTransaction(connection, event),
  );
}
