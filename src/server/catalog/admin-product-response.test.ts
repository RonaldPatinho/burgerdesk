import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveAdminProductResponse,
  createAdminProductResponse,
  setAdminProductAvailabilityResponse,
  updateAdminProductResponse,
} from "./admin-product-response";

function multipartRequest(body: FormData, method: "POST" | "PATCH"): Request {
  return new Request("http://localhost/api/administrador/products", {
    method,
    body,
  });
}

function jsonRequest(value: unknown, method: "PATCH" | "POST"): Request {
  return new Request("http://localhost/api/administrador/products/producto", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
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

test("rechaza disponibilidad y archivo sin sesión administrativa", async () => {
  const availabilityResponse = await setAdminProductAvailabilityResponse(
    jsonRequest(
      { expectedUpdatedAt: "2026-08-16T12:00:00.000Z", available: false },
      "PATCH",
    ),
    "producto-valido",
    null,
  );
  const archiveResponse = await archiveAdminProductResponse(
    jsonRequest(
      { expectedUpdatedAt: "2026-08-16T12:00:00.000Z" },
      "POST",
    ),
    "producto-valido",
    null,
  );
  assert.equal(availabilityResponse.status, 401);
  assert.equal(archiveResponse.status, 401);
});

test("rechaza campos ajenos en acciones administrativas", async () => {
  const availabilityResponse = await setAdminProductAvailabilityResponse(
    jsonRequest(
      {
        expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
        available: false,
        priceCop: 1,
      },
      "PATCH",
    ),
    "producto-valido",
    { userId: "administrador-prueba" },
  );
  const archiveResponse = await archiveAdminProductResponse(
    jsonRequest(
      {
        expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
        physicalDelete: true,
      },
      "POST",
    ),
    "producto-valido",
    { userId: "administrador-prueba" },
  );
  assert.equal(availabilityResponse.status, 400);
  assert.equal(archiveResponse.status, 400);
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
