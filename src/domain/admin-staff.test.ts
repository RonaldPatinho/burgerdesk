import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminStaffValidationError,
  normalizeAdminStaffCreate,
  normalizeAdminStaffUpdate,
} from "./admin-staff";

const userId = "123e4567-e89b-42d3-a456-426614174000";

test("normaliza el alta de Personal y rechaza el rol administrador", () => {
  assert.deepEqual(
    normalizeAdminStaffCreate({
      username: "  Caja.Norte  ",
      password: "clave-segura-123",
      fullName: "  Ana Pérez  ",
      email: " ana@burgerdesk.local ",
      role: "caja",
    }),
    {
      username: "Caja.Norte",
      password: "clave-segura-123",
      fullName: "Ana Pérez",
      email: "ana@burgerdesk.local",
      role: "caja",
    },
  );

  assert.throws(
    () =>
      normalizeAdminStaffCreate({
        username: "otro-admin",
        password: "clave-segura-123",
        fullName: "Otro Admin",
        email: "otro@burgerdesk.local",
        role: "administrador",
      }),
    (error: unknown) =>
      error instanceof AdminStaffValidationError && error.field === "role",
  );
});

test("PATCH de Personal solo admite campos editables y versión válida", () => {
  const updatedAt = "2026-08-16T20:00:00.000Z";
  assert.deepEqual(
    normalizeAdminStaffUpdate(userId, {
      expectedUpdatedAt: updatedAt,
      patch: {
        username: "ana.gomez",
        fullName: "Ana Gómez",
        email: "ana.gomez@burgerdesk.local",
        role: "caja_cocina",
        active: false,
      },
    }),
    {
      userId,
      expectedUpdatedAt: updatedAt,
      patch: {
        username: "ana.gomez",
        fullName: "Ana Gómez",
        email: "ana.gomez@burgerdesk.local",
        role: "caja_cocina",
        active: false,
      },
    },
  );

  assert.throws(
    () =>
      normalizeAdminStaffUpdate(userId, {
        expectedUpdatedAt: updatedAt,
        patch: { username: "usuario con espacios" },
      }),
    (error: unknown) =>
      error instanceof AdminStaffValidationError && error.field === "username",
  );
});
