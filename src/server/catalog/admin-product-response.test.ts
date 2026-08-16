import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminProductResponse,
  updateAdminProductResponse,
} from "./admin-product-response";

function multipartRequest(body: FormData, method: "POST" | "PATCH"): Request {
  return new Request("http://localhost/api/administrador/products", {
    method,
    body,
  });
}

test("rechaza creación y edición sin sesión administrativa", async () => {
  const createResponse = await createAdminProductResponse(
    multipartRequest(new FormData(), "POST"),
    null,
  );
  const updateResponse = await updateAdminProductResponse(
    multipartRequest(new FormData(), "PATCH"),
    "producto-valido",
    null,
  );
  assert.equal(createResponse.status, 401);
  assert.equal(updateResponse.status, 401);
});

test("rechaza una imagen cuya firma no coincide con el MIME", async () => {
  const body = new FormData();
  body.set(
    "product",
    JSON.stringify({
      name: "Producto falso",
      summary: "Imagen inválida",
      priceCop: 10_000,
      primaryCategoryId: "burgers",
      available: true,
    }),
  );
  body.set(
    "image",
    new Blob(["esto no es png"], { type: "image/png" }),
    "falso.png",
  );
  const response = await createAdminProductResponse(
    multipartRequest(body, "POST"),
    { userId: "administrador-prueba" },
  );
  assert.equal(response.status, 400);
  const value = (await response.json()) as { errors?: { image?: string } };
  assert.ok(value.errors?.image);
});
