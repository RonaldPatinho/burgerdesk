import {
  acceptedAdminProductImageMimeTypes,
  AdminProductValidationError,
  MAX_ADMIN_PRODUCT_IMAGE_BYTES,
  type AcceptedAdminProductImageMimeType,
} from "../../domain/admin-products";

function matches(
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function isAcceptedProductImageMimeType(
  value: string,
): value is AcceptedAdminProductImageMimeType {
  return acceptedAdminProductImageMimeTypes.some((mimeType) => mimeType === value);
}

export function validateProductImageBytes(
  mimeType: AcceptedAdminProductImageMimeType,
  bytes: Buffer,
): void {
  if (bytes.byteLength < 12 || bytes.byteLength > MAX_ADMIN_PRODUCT_IMAGE_BYTES) {
    throw new AdminProductValidationError(
      "image",
      "La imagen debe pesar como máximo 5 MB.",
    );
  }

  const valid =
    (mimeType === "image/jpeg" && matches(bytes, [0xff, 0xd8, 0xff])) ||
    (mimeType === "image/png" &&
      matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (mimeType === "image/webp" &&
      matches(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      matches(bytes, [0x57, 0x45, 0x42, 0x50], 8));

  if (!valid) {
    throw new AdminProductValidationError(
      "image",
      "El archivo no contiene una imagen JPEG, PNG o WebP válida.",
    );
  }
}
