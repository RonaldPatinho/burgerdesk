import assert from "node:assert/strict";
import test from "node:test";

import {
  administratorRoles,
  internalRoles,
  isAdministratorRole,
  isInternalRole,
  isStaffRole,
  normalizeUsername,
  staffRoleLabel,
  staffRoles,
  validateInternalLogin,
  validateInternalUser,
  validateUsername,
  validatePassword,
  validateFullName,
  validateEmail,
  validateRole,
} from "./internal-auth";

// ---------------------------------------------------------------------------
// Role classification
// ---------------------------------------------------------------------------

test("los roles internos incluyen exactamente los cuatro definidos", () => {
  assert.deepEqual([...internalRoles], [
    "caja",
    "cocina",
    "caja_cocina",
    "administrador",
  ]);
});

test("los roles de Personal excluyen administrador", () => {
  assert.deepEqual([...staffRoles], ["caja", "cocina", "caja_cocina"]);
});

test("el flujo Administrador admite únicamente administrador", () => {
  assert.deepEqual([...administratorRoles], ["administrador"]);
});

test("isInternalRole acepta los cuatro roles y rechaza valores arbitrarios", () => {
  for (const role of internalRoles) {
    assert.equal(isInternalRole(role), true, `debería aceptar ${role}`);
  }
  assert.equal(isInternalRole("superadmin"), false);
  assert.equal(isInternalRole(""), false);
  assert.equal(isInternalRole(null), false);
  assert.equal(isInternalRole(42), false);
});

test("isStaffRole acepta solo los tres roles operativos", () => {
  assert.equal(isStaffRole("caja"), true);
  assert.equal(isStaffRole("cocina"), true);
  assert.equal(isStaffRole("caja_cocina"), true);
  assert.equal(isStaffRole("administrador"), false);
  assert.equal(isStaffRole("gerente"), false);
});

test("isAdministratorRole acepta solo el rol administrador", () => {
  assert.equal(isAdministratorRole("administrador"), true);
  assert.equal(isAdministratorRole("caja"), false);
  assert.equal(isAdministratorRole("cocina"), false);
  assert.equal(isAdministratorRole("caja_cocina"), false);
  assert.equal(isAdministratorRole("gerente"), false);
});

test("staffRoleLabel traduce cada rol operativo a su etiqueta", () => {
  assert.equal(staffRoleLabel("caja"), "Caja");
  assert.equal(staffRoleLabel("cocina"), "Cocina");
  assert.equal(staffRoleLabel("caja_cocina"), "Caja / Cocina");
});

// ---------------------------------------------------------------------------
// Username normalisation
// ---------------------------------------------------------------------------

test("normaliza el username a minúsculas y elimina espacios externos", () => {
  assert.equal(normalizeUsername("  Caja.01  "), "caja.01");
  assert.equal(normalizeUsername("ADMIN"), "admin");
});

test("normalización devuelve null para cadenas vacías o solo espacios", () => {
  assert.equal(normalizeUsername(""), null);
  assert.equal(normalizeUsername("   "), null);
});

// ---------------------------------------------------------------------------
// Username validation
// ---------------------------------------------------------------------------

test("acepta un username dentro de las reglas", () => {
  assert.deepEqual(validateUsername("caja.01"), {});
  assert.deepEqual(validateUsername("cocina_jefe"), {});
  assert.deepEqual(validateUsername("admin-principal"), {});
});

test("rechaza username vacío", () => {
  const errors = validateUsername("");
  assert.equal(errors.username, "Escribe tu nombre de usuario.");
});

test("rechaza username demasiado corto", () => {
  const errors = validateUsername("ab");
  assert.match(errors.username!, /al menos 3/);
});

test("rechaza username con caracteres especiales", () => {
  const errors = validateUsername("caja@01");
  assert.match(errors.username!, /letras, números/);
});

test("rechaza username que excede el máximo", () => {
  const errors = validateUsername("a".repeat(65));
  assert.match(errors.username!, /superar 64/);
});

// ---------------------------------------------------------------------------
// Password validation
// ---------------------------------------------------------------------------

test("acepta contraseña de 8 a 128 caracteres", () => {
  assert.deepEqual(validatePassword("clave-segura"), {});
  assert.deepEqual(validatePassword("a".repeat(128)), {});
});

test("rechaza contraseña vacía", () => {
  assert.equal(validatePassword("").password, "Escribe tu contraseña.");
});

test("rechaza contraseña menor a 8 caracteres", () => {
  assert.match(validatePassword("corta").password!, /al menos 8/);
});

test("rechaza contraseña mayor a 128 caracteres", () => {
  assert.match(validatePassword("a".repeat(129)).password!, /superar 128/);
});

// ---------------------------------------------------------------------------
// Full name validation
// ---------------------------------------------------------------------------

test("acepta nombre completo válido", () => {
  assert.deepEqual(validateFullName("María García"), {});
});

test("rechaza nombre vacío", () => {
  assert.equal(validateFullName("").fullName, "Escribe el nombre completo.");
});

test("rechaza nombre que excede el máximo", () => {
  assert.match(validateFullName("X".repeat(121)).fullName!, /superar 120/);
});

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

test("acepta correo con formato válido", () => {
  assert.deepEqual(validateEmail("admin@burgerdesk.co"), {});
});

test("rechaza correo vacío", () => {
  assert.equal(validateEmail("").email, "Escribe el correo electrónico.");
});

test("rechaza correo sin formato", () => {
  assert.match(validateEmail("no-tiene-arroba").email!, /nombre@dominio/);
});

// ---------------------------------------------------------------------------
// Role validation
// ---------------------------------------------------------------------------

test("acepta los cuatro roles válidos", () => {
  for (const role of internalRoles) {
    assert.deepEqual(validateRole(role), {}, `debería aceptar ${role}`);
  }
});

test("rechaza un rol inexistente", () => {
  assert.equal(validateRole("gerente").role, "El rol indicado no es válido.");
});

// ---------------------------------------------------------------------------
// Composite: login
// ---------------------------------------------------------------------------

test("login válido con campos correctos", () => {
  const result = validateInternalLogin({
    username: "caja.01",
    password: "clave-segura",
  });
  assert.deepEqual(result, { valid: true });
});

test("login inválido prioriza el primer campo con error", () => {
  const result = validateInternalLogin({
    username: "",
    password: "corta",
  });
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.equal(result.firstInvalidField, "username");
  assert.ok(result.errors.username);
  assert.ok(result.errors.password);
});

// ---------------------------------------------------------------------------
// Composite: user creation
// ---------------------------------------------------------------------------

test("creación de usuario interno válida", () => {
  const result = validateInternalUser({
    username: "cocina.principal",
    password: "clave-segura",
    fullName: "Carlos López",
    email: "carlos@burgerdesk.co",
    role: "cocina",
  });
  assert.deepEqual(result, { valid: true });
});

test("creación de usuario detecta errores en todos los campos", () => {
  const result = validateInternalUser({
    username: "",
    password: "",
    fullName: "",
    email: "invalido",
    role: "gerente",
  });
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.equal(result.firstInvalidField, "username");
  assert.ok(result.errors.username);
  assert.ok(result.errors.password);
  assert.ok(result.errors.fullName);
  assert.ok(result.errors.email);
  assert.ok(result.errors.role);
});
