import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminBusinessSettingsResponse,
  updateAdminBusinessSettingsResponse,
} from "./admin-response";

function patchRequest(value: unknown): Request {
  return new Request("http://localhost/api/administrador/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

test("rechaza lectura y actualización sin sesión administrativa", async () => {
  const getResponse = await getAdminBusinessSettingsResponse(null);
  const patchResponse = await updateAdminBusinessSettingsResponse(
    patchRequest({}),
    null,
  );
  assert.equal(getResponse.status, 401);
  assert.equal(patchResponse.status, 401);
});

test("rechaza datos inválidos antes de acceder a persistencia", async () => {
  const response = await updateAdminBusinessSettingsResponse(
    patchRequest({
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
      patch: { onlinePaymentsEnabled: "sí" },
    }),
    { userId: "administrador-prueba" },
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as {
    errors?: { onlinePaymentsEnabled?: string };
  };
  assert.ok(body.errors?.onlinePaymentsEnabled);
});
