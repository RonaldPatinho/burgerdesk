import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { closeMySqlPool, getMySqlPool } from "../database/mysql";
import {
  archiveAdminProduct,
  createAdminProduct,
  getCatalogProductImage,
  getAdminProduct,
  listAdminProducts,
  setAdminProductAvailability,
  updateAdminProduct,
  AdminProductRepositoryError,
} from "./admin-repository";
import { createAdminProductId } from "../../domain/admin-products";
import { getCatalogProduct, listCatalogProducts } from "./repository";

const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const productId = `a6a-product-${runId}`;
const createdProductName = `Producto A6C ${runId}`;
const createdProductId = createAdminProductId(createdProductName);
const imagePath = "/images/products/la_bendita.png";

after(async () => {
  await getMySqlPool().execute(
    "DELETE FROM catalog_products WHERE id IN (?, ?)",
    [productId, createdProductId],
  );
  await closeMySqlPool();
});

test("crea, evita slugs duplicados y edita preservando relaciones", async () => {
  const firstImage = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
  ]);
  const created = await createAdminProduct(
    {
      name: createdProductName,
      summary: "Producto controlado de prueba",
      priceCop: 18_900,
      primaryCategoryId: "papas",
      available: true,
    },
    { mimeType: "image/png", bytes: firstImage },
  );
  assert.equal(created.id, createdProductId);
  assert.equal(created.imagePath, `/api/catalog/products/${createdProductId}/image`);
  assert.deepEqual(created.categoryIds, ["papas"]);
  assert.deepEqual(created.options, []);

  await assert.rejects(
    createAdminProduct(
      {
        name: createdProductName,
        summary: "No debe duplicarse",
        priceCop: 19_900,
        primaryCategoryId: "papas",
        available: true,
      },
      { mimeType: "image/png", bytes: firstImage },
    ),
    (error: unknown) =>
      error instanceof AdminProductRepositoryError &&
      error.code === "PRODUCT_ALREADY_EXISTS",
  );

  const pool = getMySqlPool();
  await pool.execute(
    `UPDATE catalog_products SET badge = 'Preservado' WHERE id = ?`,
    [createdProductId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_categories (product_id, category_id, sort_order)
     VALUES (?, 'clasicas', 2)`,
    [createdProductId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_options (
       product_id, id, name, price_cop, available, sort_order
     ) VALUES (?, 'extra-prueba', 'Extra preservado', 1200, TRUE, 1)`,
    [createdProductId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_default_options (product_id, option_id, sort_order)
     VALUES (?, 'extra-prueba', 1)`,
    [createdProductId],
  );

  const beforeEdit = await getAdminProduct(createdProductId);
  assert.ok(beforeEdit);
  const imageBeforeEdit = await getCatalogProductImage(createdProductId);
  assert.ok(imageBeforeEdit);
  const edited = await updateAdminProduct({
    productId: createdProductId,
    expectedUpdatedAt: beforeEdit.updatedAt,
    patch: {
      summary: "Resumen editado sin perder relaciones",
      primaryCategoryId: "burgers",
      available: false,
    },
  });

  assert.equal(edited.name, createdProductName);
  assert.equal(edited.badge, "Preservado");
  assert.deepEqual(edited.categoryIds, ["burgers", "clasicas"]);
  assert.deepEqual(edited.options, [
    {
      id: "extra-prueba",
      name: "Extra preservado",
      priceCop: 1_200,
      available: true,
    },
  ]);
  assert.deepEqual(edited.defaultOptionIds, ["extra-prueba"]);
  assert.equal((await getCatalogProductImage(createdProductId))?.etag, imageBeforeEdit.etag);
});

test("lee y actualiza preservando relaciones y campos omitidos", async () => {
  const pool = getMySqlPool();
  await pool.execute(
    `INSERT INTO catalog_products (
       id, name, summary, detail_description, price_cop, image_path,
       available, badge, sort_order, featured_order, updated_at
     ) VALUES (?, 'Producto A6A', 'Resumen original', 'Detalle preservado',
       21000, ?, TRUE, 'Badge preservado', 90, NULL, '2026-01-01 00:00:00.000')`,
    [productId, imagePath],
  );
  await pool.execute(
    `INSERT INTO catalog_product_categories (product_id, category_id, sort_order)
     VALUES (?, 'burgers', 1), (?, 'clasicas', 2)`,
    [productId, productId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_options (
       product_id, id, name, price_cop, available, sort_order
     ) VALUES (?, 'extra-a6a', 'Extra A6A', 1700, TRUE, 1)`,
    [productId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_default_options (product_id, option_id, sort_order)
     VALUES (?, 'extra-a6a', 1)`,
    [productId],
  );
  await pool.execute(
    `INSERT INTO catalog_product_images (
       product_id, mime_type, image_data, size_bytes, content_sha256
     ) VALUES (?, 'image/png', ?, 1, ?)`,
    [productId, Buffer.from([1]), "a".repeat(64)],
  );

  const initial = await getAdminProduct(productId);
  assert.ok(initial);
  assert.equal(initial.primaryCategoryId, "burgers");
  assert.deepEqual(initial.categoryIds, ["burgers", "clasicas"]);

  const updated = await updateAdminProduct({
    productId,
    expectedUpdatedAt: initial.updatedAt,
    patch: {
      name: "Producto A6A actualizado",
      summary: "Resumen actualizado",
      priceCop: 23_500,
      primaryCategoryId: "bebidas",
    },
  });

  assert.equal(updated.name, "Producto A6A actualizado");
  assert.equal(updated.priceCop, 23_500);
  assert.equal(updated.detailDescription, "Detalle preservado");
  assert.equal(updated.badge, "Badge preservado");
  assert.equal(updated.imagePath, imagePath);
  assert.equal(updated.primaryCategoryId, "bebidas");
  assert.deepEqual(updated.categoryIds, ["bebidas", "clasicas"]);
  assert.deepEqual(updated.options, [
    { id: "extra-a6a", name: "Extra A6A", priceCop: 1_700, available: true },
  ]);
  assert.deepEqual(updated.defaultOptionIds, ["extra-a6a"]);

  const searchResults = await listAdminProducts({
    search: "A6A actualizado",
    includeArchived: false,
  });
  assert.ok(searchResults.some((product) => product.id === productId));

  const [imageRows] = await pool.execute(
    `SELECT content_sha256 FROM catalog_product_images WHERE product_id = ?`,
    [productId],
  );
  assert.equal(Array.isArray(imageRows) ? imageRows.length : 0, 1);

  const publicProduct = await getCatalogProduct(productId);
  assert.deepEqual(publicProduct?.categoryIds, ["bebidas", "clasicas"]);
  assert.deepEqual(publicProduct?.defaultOptionIds, ["extra-a6a"]);

  await assert.rejects(
    updateAdminProduct({
      productId,
      expectedUpdatedAt: initial.updatedAt,
      patch: { name: "Versión obsoleta" },
    }),
    (error: unknown) =>
      error instanceof AdminProductRepositoryError &&
      error.code === "STALE_PRODUCT",
  );

  const unavailable = await setAdminProductAvailability({
    productId,
    expectedUpdatedAt: updated.updatedAt,
    available: false,
  });
  assert.equal(unavailable.available, false);
  assert.ok(
    !(await listCatalogProducts({ availableOnly: true })).some(
      (product) => product.id === productId,
    ),
  );

  const archived = await archiveAdminProduct({
    productId,
    expectedUpdatedAt: unavailable.updatedAt,
  });
  assert.equal(archived.available, false);
  assert.ok(archived.archivedAt);
  assert.equal(await getCatalogProduct(productId), null);
  assert.ok((await listAdminProducts()).some((product) => product.id === productId));
  assert.ok(
    !(await listAdminProducts({ includeArchived: false })).some(
      (product) => product.id === productId,
    ),
  );
});
