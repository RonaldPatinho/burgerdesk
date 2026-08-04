import assert from "node:assert/strict";
import test from "node:test";

import {
  validatePasswordReset,
  validateRegistration,
  validateSignIn,
} from "./auth";

test("acepta los campos documentados de acceso", () => {
  const result = validateSignIn({
    fullName: "Gabriel Duarte",
    email: "gabriel@gmail.com",
    password: "burgerdesk-demo",
    rememberEmail: true,
  });

  assert.deepEqual(result, { valid: true });
});

test("devuelve errores por campo y prioriza el primer control inválido", () => {
  const result = validateSignIn({
    fullName: "",
    email: "correo-invalido",
    password: "corta",
    rememberEmail: false,
  });

  assert.equal(result.valid, false);
  if (result.valid) return;

  assert.equal(result.firstInvalidField, "fullName");
  assert.equal(result.errors.fullName, "Escribe tu nombre completo.");
  assert.equal(
    result.errors.email,
    "Usa un correo con formato nombre@dominio.com.",
  );
  assert.equal(result.errors.password, "Usa al menos 8 caracteres.");
});

test("el registro exige la aceptación funcional de términos", () => {
  const result = validateRegistration({
    fullName: "Gabriel Duarte",
    email: "gabriel@gmail.com",
    password: "burgerdesk-demo",
    termsAccepted: false,
  });

  assert.equal(result.valid, false);
  if (result.valid) return;

  assert.equal(result.firstInvalidField, "terms");
  assert.equal(
    result.errors.terms,
    "Debes aceptar los términos para crear la cuenta.",
  );
});

test("la recuperación simulada valida el correo sin pedir más datos", () => {
  assert.deepEqual(
    validatePasswordReset({ email: "gabriel@gmail.com" }),
    { valid: true },
  );

  const invalid = validatePasswordReset({ email: "gabriel" });
  assert.equal(invalid.valid, false);
  if (invalid.valid) return;
  assert.equal(invalid.firstInvalidField, "email");
});
