import { createHash } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { stores } from "../../data/provisional";
import type {
  AcceptedAvatarMimeType,
  ClientOrderDetailView,
  ClientOrderDisplayStatus,
  ClientOrderSummaryView,
  ClientProfileDashboard,
  ClientProfileUpdateInput,
  ClientProfileView,
} from "../../domain/profile";
import { normalizeEmail } from "../../domain/profile";
import { getMySqlPool, hasMySqlErrorCode, withMySqlTransaction } from "../database/mysql";
import { getInternalOrderById } from "../orders/mysql-order-repository";
import type { PersistedOrder } from "../orders/types";

interface ProfileRow extends RowDataPacket {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  preferred_store_id: string;
  contact_whatsapp: number | boolean;
  contact_email: number | boolean;
  updated_at: Date;
  has_avatar: number | string;
}

interface StatsRow extends RowDataPacket {
  order_count: number | string;
  total_paid_cop: number | string | null;
}

interface OrderIdRow extends RowDataPacket {
  id: string;
}

interface AvatarRow extends RowDataPacket {
  mime_type: AcceptedAvatarMimeType;
  image_data: Buffer;
  size_bytes: number;
  content_sha256: string;
}

export class ClientProfileRepositoryError extends Error {
  constructor(
    public readonly code:
      | "PROFILE_NOT_FOUND"
      | "ORDER_NOT_FOUND"
      | "EMAIL_ALREADY_EXISTS",
    message: string,
  ) {
    super(message);
    this.name = "ClientProfileRepositoryError";
  }
}

function toInteger(value: number | string | null): number {
  const result = Number(value ?? 0);
  return Number.isSafeInteger(result) && result >= 0 ? result : 0;
}

function storeName(storeId: string): string {
  return stores.find((store) => store.id === storeId)?.name ?? storeId;
}

function profileFromRow(row: ProfileRow): ClientProfileView {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    preferredStoreId: row.preferred_store_id,
    preferredStoreName: storeName(row.preferred_store_id),
    contactWhatsapp: Boolean(row.contact_whatsapp),
    contactEmail: Boolean(row.contact_email),
    hasAvatar: Number(row.has_avatar) > 0,
    updatedAt: row.updated_at.toISOString(),
  };
}

function displayStatus(order: PersistedOrder): {
  status: ClientOrderDisplayStatus;
  label: string;
} {
  if (order.paymentStatus === "expirado") return { status: "expired", label: "Pago expirado" };
  if (order.paymentStatus === "fallido") return { status: "failed", label: "Pago incompleto" };
  if (order.orderStatus === "confirmado") {
    return {
      status: "confirmed",
      label: order.paymentMethod === "efectivo" ? "Confirmado · efectivo" : "Pagado",
    };
  }
  return { status: "pending", label: "Pendiente de pago" };
}

function orderCode(orderId: string): string {
  return `BD-${orderId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function toOrderSummary(order: PersistedOrder): ClientOrderSummaryView {
  const state = displayStatus(order);
  const names = order.lines.map((line) => line.productName);
  return {
    id: order.id,
    code: orderCode(order.id),
    createdAt: order.createdAt,
    status: state.status,
    statusLabel: state.label,
    productSummary:
      names.length <= 2
        ? names.join(" · ")
        : `${names.slice(0, 2).join(" · ")} y ${names.length - 2} más`,
    totalCop: order.totalCop,
  };
}

function toOrderDetail(order: PersistedOrder): ClientOrderDetailView {
  return {
    ...toOrderSummary(order),
    paymentMethod: order.paymentMethod,
    paymentMethodLabel:
      order.paymentMethod === "stripe" ? "Pago en línea con Stripe" : "Efectivo",
    storeId: order.storeId,
    storeName: storeName(order.storeId),
    subtotalCop: order.subtotalCop,
    serviceFeeCop: order.serviceFeeCop,
    confirmedAt: order.confirmedAt,
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitBasePriceCop: line.unitBasePriceCop,
      lineTotalCop: line.lineTotalCop,
      options: line.options.map((option) => ({
        optionId: option.optionId,
        optionName: option.optionName,
        priceCop: option.priceCop,
      })),
    })),
  };
}

async function loadProfile(userId: string): Promise<ClientProfileView> {
  const [rows] = await getMySqlPool().execute<ProfileRow[]>(
    `SELECT u.id, u.full_name, u.email, u.phone, u.preferred_store_id,
            u.contact_whatsapp, u.contact_email, u.updated_at,
            EXISTS(SELECT 1 FROM client_avatars a WHERE a.user_id = u.id) AS has_avatar
     FROM client_users u WHERE u.id = ? AND u.active = TRUE LIMIT 1`,
    [userId],
  );
  if (!rows[0]) {
    throw new ClientProfileRepositoryError("PROFILE_NOT_FOUND", "El perfil no existe.");
  }
  return profileFromRow(rows[0]);
}

async function loadOwnedOrderIds(userId: string, limit?: number): Promise<string[]> {
  const boundedLimit = limit && Number.isSafeInteger(limit) && limit > 0 ? limit : null;
  const sql = `SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC${
    boundedLimit ? ` LIMIT ${boundedLimit}` : ""
  }`;
  const [rows] = await getMySqlPool().execute<OrderIdRow[]>(sql, [userId]);
  return rows.map((row) => row.id);
}

export async function listClientOrders(userId: string): Promise<ClientOrderSummaryView[]> {
  const ids = await loadOwnedOrderIds(userId);
  const orders = await Promise.all(ids.map((id) => getInternalOrderById(id)));
  return orders.filter((order): order is PersistedOrder => order !== null).map(toOrderSummary);
}

export async function getClientProfileDashboard(
  userId: string,
): Promise<ClientProfileDashboard> {
  const [profile, statsRows, recentIds] = await Promise.all([
    loadProfile(userId),
    getMySqlPool().execute<StatsRow[]>(
      `SELECT COUNT(*) AS order_count,
              COALESCE(SUM(CASE WHEN payment_status = 'pagado' THEN total_cop ELSE 0 END), 0)
                AS total_paid_cop
       FROM orders WHERE user_id = ?`,
      [userId],
    ),
    loadOwnedOrderIds(userId, 3),
  ]);
  const recentRecords = await Promise.all(recentIds.map((id) => getInternalOrderById(id)));
  const stats = statsRows[0][0];
  const orderCount = toInteger(stats?.order_count ?? 0);
  return {
    profile,
    stats: {
      orderCount,
      favoriteCount: 0,
      totalPaidCop: toInteger(stats?.total_paid_cop ?? 0),
    },
    recentOrders: recentRecords
      .filter((order): order is PersistedOrder => order !== null)
      .map(toOrderSummary),
    totalOrderCount: orderCount,
  };
}

export async function getClientOrderDetail(
  userId: string,
  orderId: string,
): Promise<ClientOrderDetailView> {
  const [rows] = await getMySqlPool().execute<OrderIdRow[]>(
    "SELECT id FROM orders WHERE id = ? AND user_id = ? LIMIT 1",
    [orderId, userId],
  );
  if (!rows[0]) {
    throw new ClientProfileRepositoryError("ORDER_NOT_FOUND", "El pedido no existe.");
  }
  const order = await getInternalOrderById(rows[0].id);
  if (!order) {
    throw new ClientProfileRepositoryError("ORDER_NOT_FOUND", "El pedido no existe.");
  }
  return toOrderDetail(order);
}

export async function updateClientProfile(
  userId: string,
  input: ClientProfileUpdateInput,
  avatar: { mimeType: AcceptedAvatarMimeType; bytes: Buffer } | null,
): Promise<ClientProfileView> {
  try {
    await withMySqlTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE client_users
         SET full_name = ?, email = ?, email_normalized = ?, phone = ?,
             preferred_store_id = ?, contact_whatsapp = ?, contact_email = ?
         WHERE id = ? AND active = TRUE`,
        [
          input.fullName,
          input.email,
          normalizeEmail(input.email),
          input.phone,
          input.preferredStoreId,
          input.contactWhatsapp,
          input.contactEmail,
          userId,
        ],
      );
      if (result.affectedRows !== 1) {
        throw new ClientProfileRepositoryError("PROFILE_NOT_FOUND", "El perfil no existe.");
      }
      if (avatar) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO client_avatars
            (user_id, mime_type, image_data, size_bytes, content_sha256)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type),
             image_data = VALUES(image_data), size_bytes = VALUES(size_bytes),
             content_sha256 = VALUES(content_sha256)`,
          [
            userId,
            avatar.mimeType,
            avatar.bytes,
            avatar.bytes.byteLength,
            createHash("sha256").update(avatar.bytes).digest("hex"),
          ],
        );
      }
    });
  } catch (error: unknown) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new ClientProfileRepositoryError(
        "EMAIL_ALREADY_EXISTS",
        "Ya existe una cuenta con ese correo electrónico.",
      );
    }
    throw error;
  }
  return loadProfile(userId);
}

export async function getClientAvatar(userId: string): Promise<{
  mimeType: AcceptedAvatarMimeType;
  bytes: Buffer;
  etag: string;
} | null> {
  const [rows] = await getMySqlPool().execute<AvatarRow[]>(
    `SELECT mime_type, image_data, size_bytes, content_sha256
     FROM client_avatars WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row || row.image_data.byteLength !== row.size_bytes) return null;
  return { mimeType: row.mime_type, bytes: row.image_data, etag: row.content_sha256 };
}

export async function deleteClientAvatar(userId: string): Promise<{
  deleted: boolean;
  profile: ClientProfileView;
}> {
  const [result] = await getMySqlPool().execute<ResultSetHeader>(
    "DELETE FROM client_avatars WHERE user_id = ?",
    [userId],
  );
  return {
    deleted: result.affectedRows === 1,
    profile: await loadProfile(userId),
  };
}
