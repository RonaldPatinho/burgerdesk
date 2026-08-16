import type { CategoryId, Product, ProductId } from "./models";
import { isCategoryId, isProductId } from "./validation";

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
