import { randomUUID } from "node:crypto";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import {
  calculateStaffOrderIndicators,
  canTransitionOperationalOrderStatus,
  isOperationalOrderStatus,
  staffOrderCode,
  type OperationalOrderStatus,
  type StaffOrderDetail,
  type StaffOrderDetailLine,
  type StaffOrderDetailOption,
  type StaffOrderInboxItem,
  type StaffOrderInboxSnapshot,
  type StaffOrderStatusHistoryEntry,
} from "../../domain/staff-orders";
import {
  getMySqlPool,
  withMySqlTransaction,
} from "../database/mysql";

interface StaffInboxRow extends RowDataPacket {
  id: string;
  operational_status: string;
  total_cop: number | string;
  created_at: Date;
  line_count: number | string;
  item_count: number | string;
  first_product_id: string | null;
  first_product_name: string | null;
}

interface StaffOrderDetailRow extends RowDataPacket {
  id: string;
  payment_method: "stripe" | "efectivo";
  payment_status:
    | "pendiente"
    | "pendiente_en_efectivo"
    | "pagado"
    | "expirado"
    | "fallido";
  operational_status: string;
  subtotal_cop: number | string;
  service_fee_cop: number | string;
  total_cop: number | string;
  kitchen_note: string;
  created_at: Date;
  confirmed_at: Date | null;
  customer_name: string | null;
  customer_email: string | null;
}

interface StaffOrderLineRow extends RowDataPacket {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number | string;
  unit_price_cop: number | string;
  line_total_cop: number | string;
}

interface StaffOrderOptionRow extends RowDataPacket {
  id: string;
  order_line_id: string;
  option_id: string;
  option_name: string;
  price_cop: number | string;
}

interface StaffOrderHistoryRow extends RowDataPacket {
  previous_status: string | null;
  new_status: string;
  changed_at: Date;
}

interface LockedStaffOrderRow extends RowDataPacket {
  id: string;
  order_status: string;
  operational_status: string | null;
}

const MAX_ACTIVE_ORDERS = 100;

type StaffOrderExecutor = Pool | PoolConnection;

export class StaffOrderRepositoryError extends Error {
  constructor(
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "STATUS_CONFLICT"
      | "INVALID_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "StaffOrderRepositoryError";
  }
}

function safeNonNegativeInteger(
  value: number | string,
  fieldName: string,
): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`STAFF_ORDER_INVALID_${fieldName.toUpperCase()}`);
  }
  return result;
}

function mapInboxRow(row: StaffInboxRow): StaffOrderInboxItem {
  if (!isOperationalOrderStatus(row.operational_status)) {
    throw new Error("STAFF_ORDER_INVALID_OPERATIONAL_STATUS");
  }

  return {
    id: row.id,
    code: staffOrderCode(row.id),
    createdAt: row.created_at.toISOString(),
    operationalStatus: row.operational_status,
    totalCop: safeNonNegativeInteger(row.total_cop, "total_cop"),
    lineCount: safeNonNegativeInteger(row.line_count, "line_count"),
    itemCount: safeNonNegativeInteger(row.item_count, "item_count"),
    firstProductId: row.first_product_id,
    firstProductName: row.first_product_name,
    fulfillmentLabel: "Retiro",
  };
}

function mapHistoryRow(
  row: StaffOrderHistoryRow,
): StaffOrderStatusHistoryEntry {
  if (!isOperationalOrderStatus(row.new_status)) {
    throw new Error("STAFF_ORDER_INVALID_HISTORY_STATUS");
  }
  if (
    row.previous_status !== null &&
    !isOperationalOrderStatus(row.previous_status)
  ) {
    throw new Error("STAFF_ORDER_INVALID_HISTORY_PREVIOUS_STATUS");
  }

  return {
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    changedAt: row.changed_at.toISOString(),
  };
}

async function loadStaffOrderDetail(
  executor: StaffOrderExecutor,
  orderId: string,
): Promise<StaffOrderDetail | null> {
  const [orderRows] = await executor.execute<StaffOrderDetailRow[]>(
    `SELECT
       o.id,
       o.payment_method,
       o.payment_status,
       o.operational_status,
       o.subtotal_cop,
       o.service_fee_cop,
       o.total_cop,
       o.kitchen_note,
       o.created_at,
       o.confirmed_at,
       u.full_name AS customer_name,
       u.email AS customer_email
     FROM orders o
     LEFT JOIN client_users u ON u.id = o.user_id
     WHERE o.id = ?
       AND o.order_status = 'confirmado'
       AND o.operational_status IS NOT NULL
     LIMIT 1`,
    [orderId],
  );
  const order = orderRows[0];
  if (!order) return null;
  if (!isOperationalOrderStatus(order.operational_status)) {
    throw new Error("STAFF_ORDER_INVALID_OPERATIONAL_STATUS");
  }

  const [lineRows] = await executor.execute<StaffOrderLineRow[]>(
    `SELECT
       id, product_id, product_name, quantity,
       unit_price_cop, line_total_cop
     FROM order_lines
     WHERE order_id = ?
     ORDER BY line_position`,
    [orderId],
  );

  const lineIds = lineRows.map((line) => line.id);
  let optionRows: StaffOrderOptionRow[] = [];
  if (lineIds.length > 0) {
    const placeholders = lineIds.map(() => "?").join(", ");
    const [rows] = await executor.execute<StaffOrderOptionRow[]>(
      `SELECT
         id, order_line_id, option_id, option_name, price_cop
       FROM order_line_options
       WHERE order_line_id IN (${placeholders})
       ORDER BY order_line_id, option_position`,
      lineIds,
    );
    optionRows = rows;
  }

  const [historyRows] = await executor.execute<StaffOrderHistoryRow[]>(
    `SELECT previous_status, new_status, changed_at
     FROM order_status_history
     WHERE order_id = ?
     ORDER BY changed_at, id`,
    [orderId],
  );

  const optionsByLine = new Map<string, StaffOrderDetailOption[]>();
  for (const option of optionRows) {
    const mappedOption: StaffOrderDetailOption = {
      id: option.id,
      optionId: option.option_id,
      optionName: option.option_name,
      priceCop: safeNonNegativeInteger(option.price_cop, "option_price_cop"),
    };
    const current = optionsByLine.get(option.order_line_id) ?? [];
    current.push(mappedOption);
    optionsByLine.set(option.order_line_id, current);
  }

  const lines: StaffOrderDetailLine[] = lineRows.map((line) => ({
    id: line.id,
    productId: line.product_id,
    productName: line.product_name,
    quantity: safeNonNegativeInteger(line.quantity, "quantity"),
    unitPriceCop: safeNonNegativeInteger(
      line.unit_price_cop,
      "unit_price_cop",
    ),
    lineTotalCop: safeNonNegativeInteger(
      line.line_total_cop,
      "line_total_cop",
    ),
    options: optionsByLine.get(line.id) ?? [],
  }));

  return {
    id: order.id,
    code: staffOrderCode(order.id),
    customerName: order.customer_name?.trim() || "Cliente invitado",
    customerEmail: order.customer_email,
    fulfillmentLabel: "Retiro",
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    operationalStatus: order.operational_status,
    subtotalCop: safeNonNegativeInteger(order.subtotal_cop, "subtotal_cop"),
    serviceFeeCop: safeNonNegativeInteger(
      order.service_fee_cop,
      "service_fee_cop",
    ),
    totalCop: safeNonNegativeInteger(order.total_cop, "total_cop"),
    kitchenNote: order.kitchen_note,
    createdAt: order.created_at.toISOString(),
    confirmedAt: order.confirmed_at?.toISOString() ?? null,
    lines,
    history: historyRows.map(mapHistoryRow),
  };
}

export async function getStaffOrderInboxSnapshot(): Promise<StaffOrderInboxSnapshot> {
  const [rows] = await getMySqlPool().execute<StaffInboxRow[]>(
    `SELECT
       o.id,
       o.operational_status,
       o.total_cop,
       o.created_at,
       (SELECT COUNT(*) FROM order_lines counts WHERE counts.order_id = o.id)
         AS line_count,
       (SELECT COALESCE(SUM(items.quantity), 0)
        FROM order_lines items WHERE items.order_id = o.id)
         AS item_count,
       (SELECT first_line.product_id
        FROM order_lines first_line
        WHERE first_line.order_id = o.id
        ORDER BY first_line.line_position
        LIMIT 1) AS first_product_id,
       (SELECT first_line.product_name
        FROM order_lines first_line
        WHERE first_line.order_id = o.id
        ORDER BY first_line.line_position
        LIMIT 1) AS first_product_name
     FROM orders o
     WHERE o.order_status = 'confirmado'
       AND o.operational_status IN (
         'recibido', 'en_preparacion', 'listo_para_retirar'
       )
     ORDER BY
       CASE o.operational_status
         WHEN 'recibido' THEN 1
         WHEN 'en_preparacion' THEN 2
         WHEN 'listo_para_retirar' THEN 3
         ELSE 4
       END,
       o.created_at DESC
     LIMIT ${MAX_ACTIVE_ORDERS}`,
  );

  const orders = rows.map(mapInboxRow);
  return {
    orders,
    indicators: calculateStaffOrderIndicators(orders),
    synchronizedAt: new Date().toISOString(),
  };
}

export async function getStaffOrderDetail(
  orderId: string,
): Promise<StaffOrderDetail | null> {
  return loadStaffOrderDetail(getMySqlPool(), orderId);
}

export async function updateStaffOrderOperationalStatus(input: {
  orderId: string;
  expectedStatus: OperationalOrderStatus;
  nextStatus: OperationalOrderStatus;
  staffUserId: string;
}): Promise<StaffOrderDetail> {
  if (
    !canTransitionOperationalOrderStatus(
      input.expectedStatus,
      input.nextStatus,
    )
  ) {
    throw new StaffOrderRepositoryError(
      "INVALID_TRANSITION",
      "El cambio de estado solicitado no está permitido.",
    );
  }

  return withMySqlTransaction(async (connection) => {
    const [rows] = await connection.execute<LockedStaffOrderRow[]>(
      `SELECT id, order_status, operational_status
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [input.orderId],
    );
    const order = rows[0];

    if (
      !order ||
      order.order_status !== "confirmado" ||
      !isOperationalOrderStatus(order.operational_status)
    ) {
      throw new StaffOrderRepositoryError(
        "ORDER_NOT_FOUND",
        "No encontramos el pedido solicitado.",
      );
    }

    if (order.operational_status !== input.expectedStatus) {
      throw new StaffOrderRepositoryError(
        "STATUS_CONFLICT",
        "El pedido cambió de estado. Actualiza la pantalla antes de continuar.",
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE orders
       SET operational_status = ?, updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = ? AND operational_status = ?`,
      [input.nextStatus, input.orderId, input.expectedStatus],
    );

    if (result.affectedRows !== 1) {
      throw new StaffOrderRepositoryError(
        "STATUS_CONFLICT",
        "El pedido cambió de estado. Actualiza la pantalla antes de continuar.",
      );
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO order_status_history (
        id, order_id, previous_status, new_status,
        changed_by_user_id, change_source
      ) VALUES (?, ?, ?, ?, ?, 'staff')`,
      [
        randomUUID(),
        input.orderId,
        input.expectedStatus,
        input.nextStatus,
        input.staffUserId,
      ],
    );

    const detail = await loadStaffOrderDetail(connection, input.orderId);
    if (!detail) {
      throw new StaffOrderRepositoryError(
        "ORDER_NOT_FOUND",
        "No encontramos el pedido solicitado.",
      );
    }
    return detail;
  });
}
