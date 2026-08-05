import type { AcceptedAvatarMimeType } from "../../domain/profile";
import { ClientProfileValidationError, MAX_AVATAR_BYTES } from "../../domain/profile";

function matches(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function validateAvatarBytes(
  mimeType: AcceptedAvatarMimeType,
  bytes: Buffer,
): void {
  if (bytes.byteLength < 12 || bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new ClientProfileValidationError({
      avatar: "La fotografía debe pesar como máximo 5 MB.",
    });
  }
  const valid =
    (mimeType === "image/jpeg" && matches(bytes, [0xff, 0xd8, 0xff])) ||
    (mimeType === "image/png" &&
      matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (mimeType === "image/webp" &&
      matches(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      matches(bytes, [0x57, 0x45, 0x42, 0x50], 8));
  if (!valid) {
    throw new ClientProfileValidationError({
      avatar: "El contenido del archivo no coincide con una imagen JPEG, PNG o WebP válida.",
    });
  }
}
