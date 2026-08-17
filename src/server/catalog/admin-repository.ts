import { createHash } from "node:crypto";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import {
  assertAdminProductMutationIdentity,
  createAdminProductId,
  normalizeAdminProductCreate,
  normalizeAdminProductPatch,
  type AdminProduct,
  type AdminProductArchiveInput,
  type AdminProductAvailabilityInput,
  type AdminProductCreateInput,
  type AcceptedAdminProductImageMimeType,
  type AdminProductPatch,
  type AdminProductQuery,
  type AdminProductUpdateInput,
} from "../../domain/admin-products";
import {
  getMySqlPool,
  hasMySqlErrorCode,
  withMySqlTransaction,
} from "../database/mysql";
import { loadCatalogProductRelations } from "./repository";

interface AdminProductRow extends RowDataPacket {
  id: string;
  name: string;
  summary: string;
  detail_description: string | null;
  price_cop: number | string;
  image_path: string;
  available: number | boolean;
  badge: string | null;
  sort_order: number | string;
  featured_order: number | string | null;
  archived_at: Date | null;
  updated_at: Date;
}

interface LockedAdminProductRow extends RowDataPacket {
  id: string;
  archived_at: Date | null;
  updated_at: Date;
}

interface ActiveCategoryRow extends RowDataPacket {
  id: string;
}

interface SortOrderRow extends RowDataPacket {
  next_sort_order: number | string;
}

interface ProductImageRow extends RowDataPacket {
  mime_type: AcceptedAdminProductImageMimeType;
  image_data: Buffer;
  size_bytes: number | string;
  content_sha256: string;
}

export interface AdminProductImageInput {
  mimeType: AcceptedAdminProductImageMimeType;
  bytes: Buffer;
}

export interface CatalogProductImage {
  mimeType: AcceptedAdminProductImageMimeType;
  bytes: Buffer;
  etag: string;
}

type AdminCatalogExecutor = Pool | PoolConnection;

export class AdminProductRepositoryError extends Error {
  constructor(
    public readonly code:
      | "PRODUCT_NOT_FOUND"
      | "PRODUCT_ARCHIVED"
      | "PRODUCT_ALREADY_EXISTS"
      | "CATEGORY_NOT_FOUND"
      | "STALE_PRODUCT",
    message: string,
  ) {
    super(message);
    this.name = "AdminProductRepositoryError";
  }
}

function uploadedImagePath(productId: string): string {
  return `/api/catalog/products/${productId}/image`;
}

function safeNonNegativeInteger(
  value: number | string,
  fieldName: string,
): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError(`${fieldName} no cabe en un entero seguro.`);
  }
  return result;
}

async function queryAdminProducts(
  executor: AdminCatalogExecutor,
  input: {
    query?: AdminProductQuery;
    productId?: string;
  } = {},
): Promise<readonly AdminProduct[]> {
  const query = input.query ?? {};
  const conditions: string[] = [];
  const values: string[] = [];

  if (input.productId) {
    conditions.push("product.id = ?");
    values.push(input.productId);
  }
  if (query.includeArchived === false) {
    conditions.push("product.archived_at IS NULL");
  }
  const search = query.search?.trim() ?? "";
  if (search) {
    conditions.push(
      "LOCATE(?, CONCAT_WS(' ', product.name, product.summary, COALESCE(product.detail_description, ''))) > 0",
    );
    values.push(search);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await executor.execute<AdminProductRow[]>(
    `SELECT
       product.id,
       product.name,
       product.summary,
       product.detail_description,
       product.price_cop,
       product.image_path,
       product.available,
       product.badge,
       product.sort_order,
       product.featured_order,
       product.archived_at,
       product.updated_at
     FROM catalog_products product
     ${where}
     ORDER BY product.archived_at IS NOT NULL, product.sort_order, product.name, product.id`,
    values,
  );

  const relations = await loadCatalogProductRelations(
    executor,
    rows.map((row) => row.id),
  );

  return rows.map((row) => {
    const categoryIds = relations.categoriesByProduct.get(row.id) ?? [];
    const product: AdminProduct = {
      id: row.id,
      name: row.name,
      summary: row.summary,
      priceCop: safeNonNegativeInteger(row.price_cop, "catalog_product_price_cop"),
      imagePath: row.image_path,
      categoryIds,
      primaryCategoryId: categoryIds[0] ?? null,
      available: Boolean(row.available),
      options: relations.optionsByProduct.get(row.id) ?? [],
      defaultOptionIds: relations.defaultsByProduct.get(row.id) ?? [],
      sortOrder: safeNonNegativeInteger(row.sort_order, "catalog_product_sort_order"),
      featuredOrder:
        row.featured_order === null
          ? null
          : safeNonNegativeInteger(
              row.featured_order,
              "catalog_product_featured_order",
            ),
      archivedAt: row.archived_at?.toISOString() ?? null,
      updatedAt: row.updated_at.toISOString(),
    };
    if (row.detail_description !== null) {
      product.detailDescription = row.detail_description;
    }
    if (row.badge !== null) {
      product.badge = row.badge;
    }
    return product;
  });
}

async function lockProduct(
  connection: PoolConnection,
  productId: string,
): Promise<LockedAdminProductRow> {
  const [rows] = await connection.execute<LockedAdminProductRow[]>(
    `SELECT id, archived_at, updated_at
     FROM catalog_products
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [productId],
  );
  const product = rows[0];
  if (!product) {
    throw new AdminProductRepositoryError(
      "PRODUCT_NOT_FOUND",
      "No encontramos el producto solicitado.",
    );
  }
  return product;
}

function assertCurrentVersion(
  product: LockedAdminProductRow,
  expectedUpdatedAt: string,
): void {
  if (product.updated_at.toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
    throw new AdminProductRepositoryError(
      "STALE_PRODUCT",
      "El producto cambió. Actualiza los datos antes de guardar.",
    );
  }
}

async function assertActiveCategory(
  connection: PoolConnection,
  categoryId: string,
): Promise<void> {
  const [rows] = await connection.execute<ActiveCategoryRow[]>(
    `SELECT id
     FROM catalog_categories
     WHERE id = ? AND active = TRUE
     LIMIT 1`,
    [categoryId],
  );
  if (!rows[0]) {
    throw new AdminProductRepositoryError(
      "CATEGORY_NOT_FOUND",
      "La categoría seleccionada no está disponible.",
    );
  }
}

async function readMutatedProduct(
  connection: PoolConnection,
  productId: string,
): Promise<AdminProduct> {
  const products = await queryAdminProducts(connection, { productId });
  const product = products[0];
  if (!product) {
    throw new AdminProductRepositoryError(
      "PRODUCT_NOT_FOUND",
      "No encontramos el producto solicitado.",
    );
  }
  return product;
}

async function applyScalarPatch(
  connection: PoolConnection,
  productId: string,
  patch: AdminProductPatch,
): Promise<void> {
  const assignments: string[] = [];
  const values: Array<string | number | boolean> = [];

  if (patch.name !== undefined) {
    assignments.push("name = ?");
    values.push(patch.name);
  }
  if (patch.summary !== undefined) {
    assignments.push("summary = ?");
    values.push(patch.summary);
  }
  if (patch.priceCop !== undefined) {
    assignments.push("price_cop = ?");
    values.push(patch.priceCop);
  }
  if (patch.available !== undefined) {
    assignments.push("available = ?");
    values.push(patch.available);
  }

  if (assignments.length === 0 && patch.primaryCategoryId === undefined) {
    return;
  }

  assignments.push("updated_at = CURRENT_TIMESTAMP(3)");
  values.push(productId);
  await connection.execute<ResultSetHeader>(
    `UPDATE catalog_products
     SET ${assignments.join(", ")}
     WHERE id = ?`,
    values,
  );
}

async function replacePrimaryCategory(
  connection: PoolConnection,
  productId: string,
  categoryId: string,
): Promise<void> {
  await assertActiveCategory(connection, categoryId);
  await connection.execute<ResultSetHeader>(
    `DELETE FROM catalog_product_categories
     WHERE product_id = ? AND (sort_order = 1 OR category_id = ?)`,
    [productId, categoryId],
  );
  await connection.execute<ResultSetHeader>(
    `INSERT INTO catalog_product_categories (product_id, category_id, sort_order)
     VALUES (?, ?, 1)`,
    [productId, categoryId],
  );
}

async function saveProductImage(
  connection: PoolConnection,
  productId: string,
  image: AdminProductImageInput,
): Promise<void> {
  const contentSha256 = createHash("sha256").update(image.bytes).digest("hex");
  await connection.execute<ResultSetHeader>(
    `INSERT INTO catalog_product_images (
       product_id, mime_type, image_data, size_bytes, content_sha256
     ) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       mime_type = VALUES(mime_type),
       image_data = VALUES(image_data),
       size_bytes = VALUES(size_bytes),
       content_sha256 = VALUES(content_sha256)`,
    [
      productId,
      image.mimeType,
      image.bytes,
      image.bytes.byteLength,
      contentSha256,
    ],
  );
  await connection.execute<ResultSetHeader>(
    `UPDATE catalog_products
     SET image_path = ?, updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = ?`,
    [uploadedImagePath(productId), productId],
  );
}

export async function createAdminProduct(
  input: AdminProductCreateInput,
  image: AdminProductImageInput,
): Promise<AdminProduct> {
  const normalized = normalizeAdminProductCreate(input);
  const productId = createAdminProductId(normalized.name);

  return withMySqlTransaction(async (connection) => {
    await assertActiveCategory(connection, normalized.primaryCategoryId);
    const [sortRows] = await connection.execute<SortOrderRow[]>(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM catalog_products",
    );
    const sortOrder = safeNonNegativeInteger(
      sortRows[0]?.next_sort_order ?? 1,
      "catalog_product_sort_order",
    );

    try {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO catalog_products (
           id, name, summary, detail_description, price_cop, image_path,
           available, badge, sort_order, featured_order
         ) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, NULL)`,
        [
          productId,
          normalized.name,
          normalized.summary,
          normalized.priceCop,
          uploadedImagePath(productId),
          normalized.available,
          sortOrder,
        ],
      );
    } catch (error: unknown) {
      if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
        throw new AdminProductRepositoryError(
          "PRODUCT_ALREADY_EXISTS",
          "Ya existe un producto con ese identificador.",
        );
      }
      throw error;
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO catalog_product_categories (product_id, category_id, sort_order)
       VALUES (?, ?, 1)`,
      [productId, normalized.primaryCategoryId],
    );
    await saveProductImage(connection, productId, image);
    return readMutatedProduct(connection, productId);
  });
}

export async function listAdminProducts(
  query: AdminProductQuery = {},
): Promise<readonly AdminProduct[]> {
  return queryAdminProducts(getMySqlPool(), { query });
}

export async function getAdminProduct(
  productId: string,
): Promise<AdminProduct | null> {
  const products = await queryAdminProducts(getMySqlPool(), { productId });
  return products[0] ?? null;
}

export async function updateAdminProduct(
  input: AdminProductUpdateInput,
  image?: AdminProductImageInput,
): Promise<AdminProduct> {
  assertAdminProductMutationIdentity(input);
  const patch = normalizeAdminProductPatch(input.patch);

  return withMySqlTransaction(async (connection) => {
    const current = await lockProduct(connection, input.productId);
    assertCurrentVersion(current, input.expectedUpdatedAt);
    if (current.archived_at !== null) {
      throw new AdminProductRepositoryError(
        "PRODUCT_ARCHIVED",
        "Un producto archivado no puede modificarse.",
      );
    }

    if (patch.primaryCategoryId !== undefined) {
      await replacePrimaryCategory(
        connection,
        input.productId,
        patch.primaryCategoryId,
      );
    }
    await applyScalarPatch(connection, input.productId, patch);
    if (image) {
      await saveProductImage(connection, input.productId, image);
    }
    return readMutatedProduct(connection, input.productId);
  });
}

export async function getCatalogProductImage(
  productId: string,
): Promise<CatalogProductImage | null> {
  const [rows] = await getMySqlPool().execute<ProductImageRow[]>(
    `SELECT mime_type, image_data, size_bytes, content_sha256
     FROM catalog_product_images
     WHERE product_id = ?
     LIMIT 1`,
    [productId],
  );
  const row = rows[0];
  if (!row) return null;
  const sizeBytes = safeNonNegativeInteger(
    row.size_bytes,
    "catalog_product_image_size_bytes",
  );
  if (row.image_data.byteLength !== sizeBytes) return null;
  return {
    mimeType: row.mime_type,
    bytes: row.image_data,
    etag: row.content_sha256,
  };
}

export async function setAdminProductAvailability(
  input: AdminProductAvailabilityInput,
): Promise<AdminProduct> {
  return updateAdminProduct({
    productId: input.productId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    patch: { available: input.available },
  });
}

export async function archiveAdminProduct(
  input: AdminProductArchiveInput,
): Promise<AdminProduct> {
  assertAdminProductMutationIdentity(input);

  return withMySqlTransaction(async (connection) => {
    const current = await lockProduct(connection, input.productId);
    assertCurrentVersion(current, input.expectedUpdatedAt);
    if (current.archived_at === null) {
      await connection.execute<ResultSetHeader>(
        `UPDATE catalog_products
         SET available = FALSE,
             archived_at = CURRENT_TIMESTAMP(3),
             updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        [input.productId],
      );
    }
    return readMutatedProduct(connection, input.productId);
  });
}

export async function restoreAdminProduct(
  input: AdminProductArchiveInput,
): Promise<AdminProduct> {
  assertAdminProductMutationIdentity(input);

  return withMySqlTransaction(async (connection) => {
    const current = await lockProduct(connection, input.productId);
    assertCurrentVersion(current, input.expectedUpdatedAt);
    if (current.archived_at !== null) {
      await connection.execute<ResultSetHeader>(
        `UPDATE catalog_products
         SET available = FALSE,
             archived_at = NULL,
             updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        [input.productId],
      );
    }
    return readMutatedProduct(connection, input.productId);
  });
}
