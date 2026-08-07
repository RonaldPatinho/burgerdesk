import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  CatalogPlacement,
  Category,
  Product,
  ProductOption,
} from "../../domain/models";
import type { ProductQuery } from "../../services/contracts";
import { getMySqlPool } from "../database/mysql";

interface CategoryRow extends RowDataPacket {
  id: string;
  name: string;
  sort_order: number;
  active: number | boolean;
}

interface PlacementRow extends RowDataPacket {
  category_id: string;
  placement: CatalogPlacement;
}

interface ProductRow extends RowDataPacket {
  id: string;
  name: string;
  summary: string;
  detail_description: string | null;
  price_cop: number | string;
  image_path: string;
  available: number | boolean;
  badge: string | null;
  sort_order: number;
  featured_order: number | null;
}

interface ProductCategoryRow extends RowDataPacket {
  product_id: string;
  category_id: string;
}

interface ProductOptionRow extends RowDataPacket {
  product_id: string;
  id: string;
  name: string;
  price_cop: number | string;
  available: number | boolean;
}

interface DefaultOptionRow extends RowDataPacket {
  product_id: string;
  option_id: string;
}

type CatalogExecutor = Pick<Pool, "execute">;

function toSafeInteger(value: number | string, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RangeError(`${fieldName} no cabe en un entero seguro.`);
  }
  return parsed;
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}

async function loadCategoryPlacements(
  executor: CatalogExecutor,
  categoryIds: readonly string[],
): Promise<Map<string, CatalogPlacement[]>> {
  if (categoryIds.length === 0) return new Map();

  const [rows] = await executor.execute<PlacementRow[]>(
    `SELECT category_id, placement
     FROM catalog_category_placements
     WHERE category_id IN (${placeholders(categoryIds)})
     ORDER BY category_id, placement`,
    [...categoryIds],
  );

  const placements = new Map<string, CatalogPlacement[]>();
  for (const row of rows) {
    const current = placements.get(row.category_id) ?? [];
    current.push(row.placement);
    placements.set(row.category_id, current);
  }
  return placements;
}

export async function listCatalogCategories(
  placement?: CatalogPlacement,
): Promise<readonly Category[]> {
  const pool = getMySqlPool();
  const values: string[] = [];
  let placementCondition = "";

  if (placement) {
    placementCondition = `
      AND EXISTS (
        SELECT 1
        FROM catalog_category_placements cp
        WHERE cp.category_id = c.id
          AND cp.placement = ?
      )`;
    values.push(placement);
  }

  const [rows] = await pool.execute<CategoryRow[]>(
    `SELECT c.id, c.name, c.sort_order, c.active
     FROM catalog_categories c
     WHERE c.active = TRUE${placementCondition}
     ORDER BY c.sort_order ASC, c.id ASC`,
    values,
  );
  const categoryIds = rows.map((row) => row.id);
  const placementsByCategory = await loadCategoryPlacements(pool, categoryIds);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    order: row.sort_order,
    active: Boolean(row.active),
    placements: placementsByCategory.get(row.id) ?? [],
  }));
}

async function loadProductRelations(
  executor: CatalogExecutor,
  productIds: readonly string[],
): Promise<{
  categoriesByProduct: Map<string, string[]>;
  optionsByProduct: Map<string, ProductOption[]>;
  defaultsByProduct: Map<string, string[]>;
}> {
  if (productIds.length === 0) {
    return {
      categoriesByProduct: new Map(),
      optionsByProduct: new Map(),
      defaultsByProduct: new Map(),
    };
  }

  const inClause = placeholders(productIds);
  const [categoryRows, optionRows, defaultRows] = await Promise.all([
    executor.execute<ProductCategoryRow[]>(
      `SELECT product_id, category_id
       FROM catalog_product_categories
       WHERE product_id IN (${inClause})
       ORDER BY product_id, sort_order, category_id`,
      [...productIds],
    ),
    executor.execute<ProductOptionRow[]>(
      `SELECT product_id, id, name, price_cop, available
       FROM catalog_product_options
       WHERE product_id IN (${inClause})
       ORDER BY product_id, sort_order, id`,
      [...productIds],
    ),
    executor.execute<DefaultOptionRow[]>(
      `SELECT product_id, option_id
       FROM catalog_product_default_options
       WHERE product_id IN (${inClause})
       ORDER BY product_id, sort_order, option_id`,
      [...productIds],
    ),
  ]);

  const categoriesByProduct = new Map<string, string[]>();
  for (const row of categoryRows[0]) {
    const current = categoriesByProduct.get(row.product_id) ?? [];
    current.push(row.category_id);
    categoriesByProduct.set(row.product_id, current);
  }

  const optionsByProduct = new Map<string, ProductOption[]>();
  for (const row of optionRows[0]) {
    const current = optionsByProduct.get(row.product_id) ?? [];
    current.push({
      id: row.id,
      name: row.name,
      priceCop: toSafeInteger(row.price_cop, "catalog_option_price_cop"),
      available: Boolean(row.available),
    });
    optionsByProduct.set(row.product_id, current);
  }

  const defaultsByProduct = new Map<string, string[]>();
  for (const row of defaultRows[0]) {
    const current = defaultsByProduct.get(row.product_id) ?? [];
    current.push(row.option_id);
    defaultsByProduct.set(row.product_id, current);
  }

  return { categoriesByProduct, optionsByProduct, defaultsByProduct };
}

async function queryCatalogProducts(input: {
  query?: ProductQuery;
  productId?: string;
  featuredOnly?: boolean;
}): Promise<readonly Product[]> {
  const query = input.query ?? {};
  const conditions = ["p.archived_at IS NULL"];
  const values: Array<string | number> = [];

  if (input.productId) {
    conditions.push("p.id = ?");
    values.push(input.productId);
  }
  if (query.availableOnly || input.featuredOnly) {
    conditions.push("p.available = TRUE");
  }
  if (input.featuredOnly) {
    conditions.push("p.featured_order IS NOT NULL");
  }
  if (query.categoryId) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM catalog_product_categories category_link
        WHERE category_link.product_id = p.id
          AND category_link.category_id = ?
      )
    `);
    values.push(query.categoryId);
  }
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    conditions.push(
      "LOCATE(?, CONCAT_WS(' ', p.name, p.summary, COALESCE(p.detail_description, ''))) > 0",
    );
    values.push(search);
  }

  const orderSql = input.featuredOnly
    ? "p.featured_order ASC, p.sort_order ASC, p.id ASC"
    : "p.sort_order ASC, p.name ASC, p.id ASC";

  const pool = getMySqlPool();
  const [rows] = await pool.execute<ProductRow[]>(
    `SELECT
       p.id,
       p.name,
       p.summary,
       p.detail_description,
       p.price_cop,
       p.image_path,
       p.available,
       p.badge,
       p.sort_order,
       p.featured_order
     FROM catalog_products p
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${orderSql}`,
    values,
  );

  const ids = rows.map((row) => row.id);
  const relations = await loadProductRelations(pool, ids);

  return rows.map((row) => {
    const product: Product = {
      id: row.id,
      name: row.name,
      summary: row.summary,
      priceCop: toSafeInteger(row.price_cop, "catalog_product_price_cop"),
      imagePath: row.image_path,
      categoryIds: relations.categoriesByProduct.get(row.id) ?? [],
      available: Boolean(row.available),
      options: relations.optionsByProduct.get(row.id) ?? [],
      defaultOptionIds: relations.defaultsByProduct.get(row.id) ?? [],
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

export async function listCatalogProducts(
  query: ProductQuery = {},
): Promise<readonly Product[]> {
  return queryCatalogProducts({ query });
}

export async function getCatalogProduct(
  productId: string,
): Promise<Product | null> {
  const products = await queryCatalogProducts({ productId });
  return products[0] ?? null;
}

export async function listFeaturedCatalogProducts(): Promise<readonly Product[]> {
  return queryCatalogProducts({ featuredOnly: true });
}
