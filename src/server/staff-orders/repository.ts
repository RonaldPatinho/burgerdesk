import type { RowDataPacket } from "mysql2/promise";
import {
  calculateStaffOrderIndicators,
  isOperationalOrderStatus,
  staffOrderCode,
  type StaffOrderInboxItem,
  type StaffOrderInboxSnapshot,
} from "@/domain/staff-orders";
import { getMySqlPool } from "@/server/database/mysql";

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

const MAX_ACTIVE_ORDERS = 100;

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
