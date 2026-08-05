import assert from "node:assert/strict";
import test from "node:test";
import {
  ClientProfileValidationError,
  parseClientProfileUpdate,
} from "./profile";

test("valida y normaliza los datos editables del perfil", () => {
  assert.deepEqual(
    parseClientProfileUpdate(
      {
        fullName: "  Laura Gómez  ",
        email: " laura@example.com ",
        phone: "+57 300 123 4567",
        preferredStoreId: "sede-centro",
        contactWhatsapp: true,
        contactEmail: false,
      },
      ["sede-centro"],
    ),
    {
      fullName: "Laura Gómez",
      email: "laura@example.com",
      phone: "+57 300 123 4567",
      preferredStoreId: "sede-centro",
      contactWhatsapp: true,
      contactEmail: false,
    },
  );
});

test("rechaza correo, teléfono y sede inválidos", () => {
  assert.throws(
    () =>
      parseClientProfileUpdate(
        {
          fullName: "A",
          email: "correo-invalido",
          phone: "abc",
          preferredStoreId: "sede-ajena",
          contactWhatsapp: true,
          contactEmail: false,
        },
        ["sede-centro"],
      ),
    (error: unknown) =>
      error instanceof ClientProfileValidationError &&
      Boolean(error.errors.fullName) &&
      Boolean(error.errors.email) &&
      Boolean(error.errors.phone) &&
      Boolean(error.errors.preferredStoreId),
  );
});
