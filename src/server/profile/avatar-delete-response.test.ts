import assert from "node:assert/strict";
import test from "node:test";
import type { ClientProfileView } from "../../domain/profile";
import { createDeleteClientAvatarResponse } from "./avatar-delete-response";

const profile: ClientProfileView = {
  id: "client-1",
  fullName: "Cliente Prueba",
  email: "cliente@example.com",
  phone: "+57 300 123 4567",
  preferredStoreId: "sede-centro",
  preferredStoreName: "Sede Centro",
  contactWhatsapp: true,
  contactEmail: false,
  hasAvatar: false,
  updatedAt: "2026-08-16T12:00:00.000Z",
};

test("elimina el avatar del usuario autenticado y devuelve el perfil actualizado", async () => {
  let receivedUserId = "";
  const response = await createDeleteClientAvatarResponse(
    { userId: profile.id },
    async (userId) => {
      receivedUserId = userId;
      return { deleted: true, profile };
    },
  );

  assert.equal(receivedUserId, profile.id);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { deleted: true, profile });
});

test("responde correctamente cuando el usuario ya no tiene avatar", async () => {
  const response = await createDeleteClientAvatarResponse(
    { userId: profile.id },
    async () => ({ deleted: false, profile }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: false, profile });
});

test("rechaza la eliminación sin una sesión autenticada", async () => {
  let called = false;
  const response = await createDeleteClientAvatarResponse(null, async () => {
    called = true;
    return { deleted: true, profile };
  });

  assert.equal(called, false);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Debes iniciar sesión." });
});
