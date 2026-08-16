import assert from "node:assert/strict";
import test from "node:test";
import {
  AdminProductValidationError,
  assertAdminProductMutationIdentity,
  createAdminProductId,
  normalizeAdminProductCreate,
  normalizeAdminProductPatch,
} from "./admin-products";

test("normaliza un producto nuevo y genera un slug estable", () => {
  assert.deepEqual(
    normalizeAdminProductCreate({
      name: "  Hamburguesa Única  ",
      summary: "  Carne y cheddar  ",
      priceCop: 27_900,
      primaryCategoryId: "burgers",
      available: true,
    }),
    {
      name: "Hamburguesa Única",
      summary: "Carne y cheddar",
      priceCop: 27_900,
      primaryCategoryId: "burgers",
      available: true,
    },
  );
  assert.equal(createAdminProductId("Hamburguesa Única"), "hamburguesa-unica");
});

test("rechaza altas incompletas, precios inválidos y nombres sin slug", () => {
  assert.throws(
    () =>
      normalizeAdminProductCreate({
        name: "Producto",
        summary: "Resumen",
        priceCop: 0,
        primaryCategoryId: "burgers",
        available: true,
      }),
    (error: unknown) =>
      error instanceof AdminProductValidationError && error.field === "priceCop",
  );
  assert.throws(
    () => createAdminProductId("---"),
    (error: unknown) =>
      error instanceof AdminProductValidationError && error.field === "name",
  );
});

test("normaliza únicamente los campos editables documentados", () => {
  assert.deepEqual(
    normalizeAdminProductPatch({
      name: "  Burger dinámica  ",
      summary: "  Descripción real  ",
      priceCop: 25_900,
      primaryCategoryId: "burgers",
      available: false,
    }),
    {
      name: "Burger dinámica",
      summary: "Descripción real",
      priceCop: 25_900,
      primaryCategoryId: "burgers",
      available: false,
    },
  );
});

test("rechaza campos ocultos y mutaciones vacías", () => {
  assert.throws(
    () => normalizeAdminProductPatch({ imagePath: "/imagen-no-confiable.png" }),
    (error: unknown) =>
      error instanceof AdminProductValidationError &&
      error.field === "imagePath",
  );
  assert.throws(
    () => normalizeAdminProductPatch({}),
    (error: unknown) =>
      error instanceof AdminProductValidationError && error.field === "patch",
  );
});

test("valida identidad dinámica y versión de la mutación", () => {
  assert.doesNotThrow(() =>
    assertAdminProductMutationIdentity({
      productId: "producto-dinamico",
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
    }),
  );
  assert.throws(() =>
    assertAdminProductMutationIdentity({
      productId: "Producto inseguro",
      expectedUpdatedAt: "sin-fecha",
    }),
  );
});
