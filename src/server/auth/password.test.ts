import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password";

test("la contraseña se almacena con sal y se verifica sin texto plano", async () => {
  const encoded = await hashPassword("una-clave-segura");
  assert.doesNotMatch(encoded, /una-clave-segura/);
  assert.equal(await verifyPassword("una-clave-segura", encoded), true);
  assert.equal(await verifyPassword("otra-clave", encoded), false);
});
