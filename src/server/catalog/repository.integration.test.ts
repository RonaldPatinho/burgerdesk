import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { closeMySqlPool, getMySqlPool } from "../database/mysql";
import {
  getCatalogProduct,
  listCatalogCategories,
  listCatalogProducts,
  listFeaturedCatalogProducts,
} from "./repository";

const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const categoryId = `a5-cat-${runId}`;
const productId = `a5-product-${runId}`;
const unavailableProductId = `a5-off-${runId}`;

after(async () => {
  const pool = getMySqlPool();
  await pool.execute(
    "DELETE FROM catalog_products WHERE id IN (?, ?)",
    [productId, unavailableProductId],
  );
  await pool.execute("DELETE FROM catalog_categories WHERE id = ?", [categoryId]);
  await closeMySqlPool();
});

test("lee desde MySQL el seed histórico del catálogo sin cambiar sus relaciones", async () => {
  const [menuCategories, products, featured] = await Promise.all([
    listCatalogCategories("menu"),
    listCatalogProducts({ availableOnly: true }),
    listFeaturedCatalogProducts(),
  ]);

  assert.deepEqual(
    menuCategories.map((category) => category.name),
    ["Burgers", "Papas", "Bebidas"],
  );
  assert.equal(products.length, 8);
  const laBendita = products.find((product) => product.id === "la-bendita");
  assert.ok(laBendita);
  assert.equal(laBendita.priceCop, 26_900);
  assert.deepEqual(laBendita.categoryIds, ["burgers", "clasicas"]);
  assert.deepEqual(
    laBendita.options.map((option) => option.id),
    ["cheddar-extra", "tocineta", "cebolla", "salsa-incluida"],
  );
  assert.deepEqual(
    laBendita.defaultOptionIds,
    ["cheddar-extra", "salsa-incluida"],
  );
  assert.deepEqual(
    featured.map((product) => product.id),
    ["la-bendita", "combo-gloria"],
  );
});

test("acepta identificadores dinámicos y reconstruye categorías, opciones y predeterminados", async () => {
  const pool = getMySqlPool();
  await pool.execute(
    `INSERT INTO catalog_categories (id, name, sort_order, active)
     VALUES (?, 'Temporal A5', 99, TRUE)`,
    [categoryId],
  );
  await pool.execute(
    `INSERT INTO catalog_category_placements (category_id, placement)
     VALUES (?, 'menu')`,
    [categoryId],
  );
  await pool.execute(
    `INSERT INTO catalog_products (
       id, name, summary, detail_description, price_cop, image_path,
       available, badge, sort_order, featured_order
     ) VALUES (?, 'Producto dinámico A5', 'Prueba persistente', NULL, 12345,
       '/images/products/la_bendita.png', TRUE, NULL, 99, NULL)`,
    [productId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_categories (product_id, category_id, sort_order)
     VALUES (?, ?, 1)`,
    [productId, categoryId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_options (
       product_id, id, name, price_cop, available, sort_order
     ) VALUES (?, 'extra-a5', 'Extra A5', 500, TRUE, 1)`,
    [productId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_default_options (
       product_id, option_id, sort_order
     ) VALUES (?, 'extra-a5', 1)`,
    [productId],
  );

  const product = await getCatalogProduct(productId);
  assert.ok(product);
  assert.equal(product.name, "Producto dinámico A5");
  assert.deepEqual(product.categoryIds, [categoryId]);
  assert.deepEqual(product.options, [
    {
      id: "extra-a5",
      name: "Extra A5",
      priceCop: 500,
      available: true,
    },
  ]);
  assert.deepEqual(product.defaultOptionIds, ["extra-a5"]);

  const searched = await listCatalogProducts({
    categoryId,
    search: "dinámico",
    availableOnly: true,
  });
  assert.deepEqual(searched.map((candidate) => candidate.id), [productId]);
});

test("distingue productos no disponibles de productos archivados", async () => {
  const pool = getMySqlPool();
  await pool.execute(
    `INSERT INTO catalog_products (
       id, name, summary, detail_description, price_cop, image_path,
       available, badge, sort_order, featured_order
     ) VALUES (?, 'No disponible A5', 'Prueba de estado', NULL, 9000,
       '/images/products/la_bendita.png', FALSE, NULL, 100, NULL)`,
    [unavailableProductId],
  );

  const all = await listCatalogProducts();
  const available = await listCatalogProducts({ availableOnly: true });
  assert.ok(all.some((product) => product.id === unavailableProductId));
  assert.ok(!available.some((product) => product.id === unavailableProductId));

  await pool.execute(
    "UPDATE catalog_products SET archived_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
    [unavailableProductId],
  );
  assert.equal(await getCatalogProduct(unavailableProductId), null);
});
