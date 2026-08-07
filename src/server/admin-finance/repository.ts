import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  calculateAdministratorAverageTicket,
  calculateAdministratorVariationPercent,
  createAdministratorSalesSeries,
  isAdministratorPaymentMethodFilter,
  isAdministratorPaymentStatusFilter,
  normalizeAdministratorTransactionQuery,
  resolveAdministratorFinancialPeriod,
  ADMINISTRATOR_BUSINESS_TIME_ZONE,
  ADMINISTRATOR_DEFAULT_STORE_ID,
  type AdministratorFinancialPeriodKind,
  type AdministratorFinancialSnapshot,
  type AdministratorPaidSaleEntry,
  type AdministratorPaymentMethod,
  type AdministratorPaymentStatus,
  type AdministratorProductRankingItem,
  type AdministratorTransaction,
  type AdministratorTransactionPage,
  type AdministratorTransactionQueryInput,
} from "../../domain/admin-finance";
import { staffOrderCode } from "../../domain/staff-orders";
import { withMySqlTransaction } from "../database/mysql";

interface FinancialAggregateRow extends RowDataPacket {
  paid_sales_cop: number | string | null;
  paid_order_count: number | string;
  previous_paid_sales_cop: number | string | null;
}

interface CountRow extends RowDataPacket {
  total_count: number | string;
}

interface PaidSaleRow extends RowDataPacket {
  financial_at: Date;
  total_cop: number | string;
}

interface ProductRankingRow extends RowDataPacket {
  product_id: string;
  product_name: string;
  quantity_sold: number | string;
  sales_cop: number | string;
}

interface TransactionAggregateRow extends RowDataPacket {
  total_items: number | string;
  filtered_paid_total_cop: number | string | null;
}

interface PaidTotalRow extends RowDataPacket {
  paid_total_cop: number | string | null;
}

interface TransactionRow extends RowDataPacket {
  order_id: string;
  payment_method: string;
  payment_status: string;
  total_cop: number | string;
  transaction_at: Date;
  confirmed_at: Date | null;
}

const FINANCIAL_ORDERS_CTE = `WITH paid_attempts AS (
  SELECT order_id, MAX(completed_at) AS paid_at
  FROM payment_attempts
  WHERE status = 'pagado'
    AND completed_at IS NOT NULL
  GROUP BY order_id
), financial_orders AS (
  SELECT
    o.id,
    o.store_id,
    o.order_status,
    o.payment_method,
    o.payment_status,
    o.total_cop,
    o.confirmed_at,
    CASE
      WHEN o.payment_method = 'stripe' THEN paid_attempts.paid_at
      ELSE COALESCE(o.confirmed_at, o.created_at)
    END AS financial_at
  FROM orders o
  LEFT JOIN paid_attempts ON paid_attempts.order_id = o.id
  WHERE o.store_id = ?
    AND o.order_status = 'confirmado'
)`;

const TRANSACTION_ORDERS_CTE = `WITH ranked_attempts AS (
  SELECT
    p.order_id,
    p.attempt_number,
    p.completed_at,
    p.expired_at,
    p.failed_at,
    p.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY p.order_id
      ORDER BY p.attempt_number DESC, p.id DESC
    ) AS attempt_rank
  FROM payment_attempts p
), transaction_orders AS (
  SELECT
    o.id AS order_id,
    o.payment_method,
    o.payment_status,
    o.total_cop,
    o.confirmed_at,
    CASE
      WHEN o.payment_method = 'stripe' THEN COALESCE(
        ranked_attempts.completed_at,
        ranked_attempts.expired_at,
        ranked_attempts.failed_at,
        ranked_attempts.created_at,
        o.created_at
      )
      ELSE COALESCE(o.confirmed_at, o.created_at)
    END AS transaction_at
  FROM orders o
  LEFT JOIN ranked_attempts
    ON ranked_attempts.order_id = o.id
   AND ranked_attempts.attempt_rank = 1
  WHERE o.store_id = ?
)`;

function toSafeInteger(
  value: number | string | null,
  fieldName: string,
): number {
  if (value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RangeError(`${fieldName} no cabe en un entero seguro.`);
  }
  return parsed;
}

function toAdministratorPaymentMethod(
  value: string,
): AdministratorPaymentMethod {
  if (!isAdministratorPaymentMethodFilter(value) || value === "all") {
    throw new RangeError("La forma de pago persistida no es válida.");
  }
  return value;
}

function toAdministratorPaymentStatus(
  value: string,
): AdministratorPaymentStatus {
  if (!isAdministratorPaymentStatusFilter(value) || value === "all") {
    throw new RangeError("El estado de pago persistido no es válido.");
  }
  return value;
}

function dateRangeValues(startAt: string, endAt: string): [Date, Date] {
  return [new Date(startAt), new Date(endAt)];
}

function sqlUnsignedInteger(value: number, fieldName: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} no es un entero SQL seguro.`);
  }
  return String(value);
}

async function queryFinancialAggregate(
  connection: PoolConnection,
  input: {
    storeId: string;
    currentStartAt: string;
    currentEndAt: string;
    previousStartAt: string;
    previousEndAt: string;
  },
): Promise<FinancialAggregateRow> {
  const [currentStart, currentEnd] = dateRangeValues(
    input.currentStartAt,
    input.currentEndAt,
  );
  const [previousStart, previousEnd] = dateRangeValues(
    input.previousStartAt,
    input.previousEndAt,
  );
  const [rows] = await connection.execute<FinancialAggregateRow[]>(
    `${FINANCIAL_ORDERS_CTE}
     SELECT
       COALESCE(SUM(CASE
         WHEN payment_status = 'pagado'
          AND financial_at >= ? AND financial_at < ?
         THEN total_cop ELSE 0 END), 0) AS paid_sales_cop,
       SUM(CASE
         WHEN payment_status = 'pagado'
          AND financial_at >= ? AND financial_at < ?
         THEN 1 ELSE 0 END) AS paid_order_count,
       COALESCE(SUM(CASE
         WHEN payment_status = 'pagado'
          AND financial_at >= ? AND financial_at < ?
         THEN total_cop ELSE 0 END), 0) AS previous_paid_sales_cop
     FROM financial_orders`,
    [
      input.storeId,
      currentStart,
      currentEnd,
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("ADMIN_FINANCIAL_AGGREGATE_MISSING");
  return row;
}

async function queryConfirmedOrderCount(
  connection: PoolConnection,
  input: { storeId: string; startAt: string; endAt: string },
): Promise<number> {
  const [startAt, endAt] = dateRangeValues(input.startAt, input.endAt);
  const [rows] = await connection.execute<CountRow[]>(
    `SELECT COUNT(*) AS total_count
     FROM orders
     WHERE store_id = ?
       AND order_status = 'confirmado'
       AND confirmed_at >= ?
       AND confirmed_at < ?`,
    [input.storeId, startAt, endAt],
  );
  return toSafeInteger(rows[0]?.total_count ?? 0, "confirmed_order_count");
}

async function queryPaidSales(
  connection: PoolConnection,
  input: { storeId: string; startAt: string; endAt: string },
): Promise<AdministratorPaidSaleEntry[]> {
  const [startAt, endAt] = dateRangeValues(input.startAt, input.endAt);
  const [rows] = await connection.execute<PaidSaleRow[]>(
    `${FINANCIAL_ORDERS_CTE}
     SELECT financial_at, total_cop
     FROM financial_orders
     WHERE payment_status = 'pagado'
       AND financial_at >= ?
       AND financial_at < ?
     ORDER BY financial_at ASC, id ASC`,
    [input.storeId, startAt, endAt],
  );
  return rows.map((row) => ({
    occurredAt: row.financial_at.toISOString(),
    totalCop: toSafeInteger(row.total_cop, "sale_total_cop"),
  }));
}

async function queryProductRanking(
  connection: PoolConnection,
  input: {
    storeId: string;
    startAt: string;
    endAt: string;
    limit: number;
  },
): Promise<AdministratorProductRankingItem[]> {
  const [startAt, endAt] = dateRangeValues(input.startAt, input.endAt);
  const [rows] = await connection.execute<ProductRankingRow[]>(
    `${FINANCIAL_ORDERS_CTE}
     SELECT
       order_items.product_id,
       MAX(order_items.product_name) AS product_name,
       SUM(order_items.quantity) AS quantity_sold,
       SUM(order_items.line_total_cop) AS sales_cop
     FROM financial_orders
     INNER JOIN order_lines order_items
       ON order_items.order_id = financial_orders.id
     WHERE financial_orders.payment_status = 'pagado'
       AND financial_orders.financial_at >= ?
       AND financial_orders.financial_at < ?
     GROUP BY order_items.product_id
     ORDER BY quantity_sold DESC, sales_cop DESC, product_name ASC, product_id ASC
     LIMIT ${sqlUnsignedInteger(input.limit, "ranking_limit")}`,
    [input.storeId, startAt, endAt],
  );
  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    quantitySold: toSafeInteger(row.quantity_sold, "quantity_sold"),
    salesCop: toSafeInteger(row.sales_cop, "product_sales_cop"),
  }));
}

export async function getAdministratorFinancialSnapshot(input?: {
  periodKind?: AdministratorFinancialPeriodKind;
  now?: Date;
  timeZone?: string;
  storeId?: string;
  rankingLimit?: number;
}): Promise<AdministratorFinancialSnapshot> {
  const period = resolveAdministratorFinancialPeriod({
    kind: input?.periodKind ?? "day",
    now: input?.now,
    timeZone: input?.timeZone ?? ADMINISTRATOR_BUSINESS_TIME_ZONE,
  });
  const storeId = input?.storeId?.trim() || ADMINISTRATOR_DEFAULT_STORE_ID;
  const requestedRankingLimit = input?.rankingLimit;
  const rankingLimitValue =
    typeof requestedRankingLimit === "number" &&
    Number.isInteger(requestedRankingLimit)
      ? requestedRankingLimit
      : 5;
  const rankingLimit = Math.min(Math.max(rankingLimitValue, 1), 20);

  return withMySqlTransaction(async (connection) => {
    const aggregate = await queryFinancialAggregate(connection, {
      storeId,
      currentStartAt: period.startAt,
      currentEndAt: period.endAt,
      previousStartAt: period.previousStartAt,
      previousEndAt: period.previousEndAt,
    });
    const confirmedOrderCount = await queryConfirmedOrderCount(connection, {
      storeId,
      startAt: period.startAt,
      endAt: period.endAt,
    });
    const paidSales = await queryPaidSales(connection, {
      storeId,
      startAt: period.startAt,
      endAt: period.endAt,
    });
    const topProducts = await queryProductRanking(connection, {
      storeId,
      startAt: period.startAt,
      endAt: period.endAt,
      limit: rankingLimit,
    });

    const paidSalesCop = toSafeInteger(
      aggregate.paid_sales_cop,
      "paid_sales_cop",
    );
    const paidOrderCount = toSafeInteger(
      aggregate.paid_order_count,
      "paid_order_count",
    );
    const previousPaidSalesCop = toSafeInteger(
      aggregate.previous_paid_sales_cop,
      "previous_paid_sales_cop",
    );

    return {
      period,
      summary: {
        paidSalesCop,
        paidOrderCount,
        confirmedOrderCount,
        averageTicketCop: calculateAdministratorAverageTicket(
          paidSalesCop,
          paidOrderCount,
        ),
        previousPaidSalesCop,
        salesVariationPercent: calculateAdministratorVariationPercent(
          paidSalesCop,
          previousPaidSalesCop,
        ),
      },
      salesSeries: createAdministratorSalesSeries(period, paidSales),
      topProducts,
    };
  });
}

function transactionFilterSql(input: {
  search: string;
  paymentMethod: string;
  paymentStatus: string;
}): { sql: string; values: Array<string> } {
  const conditions: string[] = [];
  const values: string[] = [];

  if (input.search) {
    conditions.push(
      `(LOCATE(?, LOWER(order_id)) > 0 OR
        LOCATE(?, LOWER(LEFT(REPLACE(order_id, '-', ''), 8))) > 0)`,
    );
    values.push(input.search, input.search);
  }
  if (input.paymentMethod !== "all") {
    conditions.push("payment_method = ?");
    values.push(input.paymentMethod);
  }
  if (input.paymentStatus !== "all") {
    conditions.push("payment_status = ?");
    values.push(input.paymentStatus);
  }

  return {
    sql: conditions.length > 0 ? ` AND ${conditions.join(" AND ")}` : "",
    values,
  };
}

export async function getAdministratorTransactions(
  input: AdministratorTransactionQueryInput = {},
): Promise<AdministratorTransactionPage> {
  const query = normalizeAdministratorTransactionQuery(input);
  const [startAt, endAt] = dateRangeValues(
    query.period.startAt,
    query.period.endAt,
  );
  const filters = transactionFilterSql(query);
  const offset = (query.page - 1) * query.pageSize;

  return withMySqlTransaction(async (connection) => {
    const [paidRows] = await connection.execute<PaidTotalRow[]>(
      `${TRANSACTION_ORDERS_CTE}
       SELECT COALESCE(SUM(total_cop), 0) AS paid_total_cop
       FROM transaction_orders
       WHERE transaction_at >= ?
         AND transaction_at < ?
         AND payment_status = 'pagado'`,
      [query.storeId, startAt, endAt],
    );

    const [aggregateRows] = await connection.execute<TransactionAggregateRow[]>(
      `${TRANSACTION_ORDERS_CTE}
       SELECT
         COUNT(*) AS total_items,
         COALESCE(SUM(CASE
           WHEN payment_status = 'pagado' THEN total_cop ELSE 0 END
         ), 0) AS filtered_paid_total_cop
       FROM transaction_orders
       WHERE transaction_at >= ?
         AND transaction_at < ?${filters.sql}`,
      [query.storeId, startAt, endAt, ...filters.values],
    );

    const [rows] = await connection.execute<TransactionRow[]>(
      `${TRANSACTION_ORDERS_CTE}
       SELECT
         order_id,
         payment_method,
         payment_status,
         total_cop,
         transaction_at,
         confirmed_at
       FROM transaction_orders
       WHERE transaction_at >= ?
         AND transaction_at < ?${filters.sql}
       ORDER BY transaction_at DESC, order_id DESC
       LIMIT ${sqlUnsignedInteger(query.pageSize, "transaction_page_size")}
       OFFSET ${sqlUnsignedInteger(offset, "transaction_offset")}`,
      [query.storeId, startAt, endAt, ...filters.values],
    );

    const aggregate = aggregateRows[0];
    const totalItems = toSafeInteger(
      aggregate?.total_items ?? 0,
      "transaction_total_items",
    );
    const items: AdministratorTransaction[] = rows.map((row) => ({
      orderId: row.order_id,
      orderCode: staffOrderCode(row.order_id),
      paymentMethod: toAdministratorPaymentMethod(row.payment_method),
      paymentStatus: toAdministratorPaymentStatus(row.payment_status),
      totalCop: toSafeInteger(row.total_cop, "transaction_total_cop"),
      transactionAt: row.transaction_at.toISOString(),
      confirmedAt: row.confirmed_at?.toISOString() ?? null,
    }));

    return {
      period: query.period,
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize),
      paidTotalCop: toSafeInteger(
        paidRows[0]?.paid_total_cop ?? 0,
        "period_paid_total_cop",
      ),
      filteredPaidTotalCop: toSafeInteger(
        aggregate?.filtered_paid_total_cop ?? 0,
        "filtered_paid_total_cop",
      ),
    };
  });
}
