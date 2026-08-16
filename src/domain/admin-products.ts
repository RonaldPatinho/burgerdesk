import type { CategoryId, Product, ProductId } from "./models";
import { isCategoryId, isProductId } from "./validation";

export const MAX_ADMIN_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const acceptedAdminProductImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AcceptedAdminProductImageMimeType =
  (typeof acceptedAdminProductImageMimeTypes)[number];

export interface AdminProduct extends Product {
  primaryCategoryId: CategoryId | null;
  sortOrder: number;
  featuredOrder: number | null;
  archivedAt: string | null;
  updatedAt: string;
}

export interface AdminProductQuery {
  search?: string;
  includeArchived?: boolean;
}

export interface AdminProductCreateInput {
  name: string;
  summary: string;
  priceCop: number;
  primaryCategoryId: CategoryId;
  available: boolean;
}

export interface AdminProductPatch {
  name?: string;
  summary?: string;
  priceCop?: number;
  primaryCategoryId?: CategoryId;
  available?: boolean;
}

export interface AdminProductUpdateInput {
  productId: ProductId;
  expectedUpdatedAt: string;
  patch: AdminProductPatch;
}

export interface AdminProductAvailabilityInput {
  productId: ProductId;
  expectedUpdatedAt: string;
  available: boolean;
}

export interface AdminProductArchiveInput {
  productId: ProductId;
  expectedUpdatedAt: string;
}

export class AdminProductValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "AdminProductValidationError";
  }
}

const mutableFields = new Set([
  "name",
  "summary",
  "priceCop",
  "primaryCategoryId",
  "available",
]);

const createFields = new Set([
  "name",
  "summary",
  "priceCop",
  "primaryCategoryId",
  "available",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeAdminProductPatch(
  value: unknown,
): AdminProductPatch {
  if (!isRecord(value)) {
    throw new AdminProductValidationError(
      "patch",
      "Los cambios del producto no son válidos.",
    );
  }

  const unexpectedField = Object.keys(value).find(
    (field) => !mutableFields.has(field),
  );
  if (unexpectedField) {
    throw new AdminProductValidationError(
      unexpectedField,
      "El campo no forma parte del contrato editable.",
    );
  }

  const patch: AdminProductPatch = {};

  if (value.name !== undefined) {
    if (typeof value.name !== "string") {
      throw new AdminProductValidationError("name", "El nombre no es válido.");
    }
    const name = value.name.trim();
    if (name.length < 1 || name.length > 191) {
      throw new AdminProductValidationError(
        "name",
        "El nombre debe tener entre 1 y 191 caracteres.",
      );
    }
    patch.name = name;
  }

  if (value.summary !== undefined) {
    if (typeof value.summary !== "string") {
      throw new AdminProductValidationError(
        "summary",
        "La descripción no es válida.",
      );
    }
    const summary = value.summary.trim();
    if (summary.length < 1 || summary.length > 255) {
      throw new AdminProductValidationError(
        "summary",
        "La descripción debe tener entre 1 y 255 caracteres.",
      );
    }
    patch.summary = summary;
  }

  if (value.priceCop !== undefined) {
    if (!Number.isSafeInteger(value.priceCop) || Number(value.priceCop) < 1) {
      throw new AdminProductValidationError(
        "priceCop",
        "El precio debe ser un entero positivo en COP.",
      );
    }
    patch.priceCop = Number(value.priceCop);
  }

  if (value.primaryCategoryId !== undefined) {
    if (!isCategoryId(value.primaryCategoryId)) {
      throw new AdminProductValidationError(
        "primaryCategoryId",
        "La categoría principal no es válida.",
      );
    }
    patch.primaryCategoryId = value.primaryCategoryId;
  }

  if (value.available !== undefined) {
    if (typeof value.available !== "boolean") {
      throw new AdminProductValidationError(
        "available",
        "La disponibilidad no es válida.",
      );
    }
    patch.available = value.available;
  }

  if (Object.keys(patch).length === 0) {
    throw new AdminProductValidationError(
      "patch",
      "Debes indicar al menos un cambio.",
    );
  }

  return patch;
}

export function normalizeAdminProductCreate(
  value: unknown,
): AdminProductCreateInput {
  if (!isRecord(value)) {
    throw new AdminProductValidationError(
      "product",
      "Los datos del producto no son válidos.",
    );
  }

  const unexpectedField = Object.keys(value).find(
    (field) => !createFields.has(field),
  );
  if (unexpectedField) {
    throw new AdminProductValidationError(
      unexpectedField,
      "El campo no forma parte del nuevo producto.",
    );
  }

  for (const field of createFields) {
    if (value[field] === undefined) {
      throw new AdminProductValidationError(
        field,
        "Completa este campo antes de guardar.",
      );
    }
  }

  const normalized = normalizeAdminProductPatch(value);
  return normalized as AdminProductCreateInput;
}

export function createAdminProductId(name: string): ProductId {
  const productId = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");

  if (!isProductId(productId)) {
    throw new AdminProductValidationError(
      "name",
      "El nombre debe contener letras o números para generar el identificador.",
    );
  }
  return productId;
}

export function assertAdminProductMutationIdentity(input: {
  productId: unknown;
  expectedUpdatedAt: unknown;
}): asserts input is {
  productId: ProductId;
  expectedUpdatedAt: string;
} {
  if (!isProductId(input.productId)) {
    throw new AdminProductValidationError(
      "productId",
      "El identificador del producto no es válido.",
    );
  }

  if (
    typeof input.expectedUpdatedAt !== "string" ||
    !Number.isFinite(Date.parse(input.expectedUpdatedAt))
  ) {
    throw new AdminProductValidationError(
      "expectedUpdatedAt",
      "La versión del producto no es válida.",
    );
  }
}
