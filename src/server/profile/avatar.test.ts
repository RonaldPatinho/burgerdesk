import assert from "node:assert/strict";
import test from "node:test";
import { ClientProfileValidationError } from "../../domain/profile";
import { validateAvatarBytes } from "./avatar";

test("acepta firmas reales JPEG, PNG y WebP", () => {
  assert.doesNotThrow(() =>
    validateAvatarBytes("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(8).fill(0)])),
  );
  assert.doesNotThrow(() =>
    validateAvatarBytes(
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
    ),
  );
  assert.doesNotThrow(() =>
    validateAvatarBytes(
      "image/webp",
      Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    ),
  );
});

test("rechaza contenido que solo declara un MIME permitido", () => {
  assert.throws(
    () => validateAvatarBytes("image/png", Buffer.from("contenido-falso")),
    ClientProfileValidationError,
  );
});
