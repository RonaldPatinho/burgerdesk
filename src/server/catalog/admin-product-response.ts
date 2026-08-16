import {
  AdminProductValidationError,
  MAX_ADMIN_PRODUCT_IMAGE_BYTES,
  normalizeAdminProductCreate,
  normalizeAdminProductPatch,
  type AdminProductPatch,
} from "../../domain/admin-products";
import { isProductId } from "../../domain/validation";
import {
  AdminProductRepositoryError,
  createAdminProduct,
  updateAdminProduct,
  type AdminProductImageInput,
} from "./admin-repository";
import {
  isAcceptedProductImageMimeType,
  validateProductImageBytes,
} from "./product-image";

const MAX_MULTIPART_BYTES = 5_600_000;
const MAX_PRODUCT_JSON_BYTES = 8_192;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

type AdministratorSession = { userId: string } | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(
  status: number,
  message: string,
  errors: Readonly<Record<string, string>> = {},
): Response {
  return Response.json(
    { message, errors },
    { status, headers: NO_STORE_HEADERS },
  );
}

async function readMultipartProduct(
  request: Request,
  imageRequired: boolean,
): Promise<{ value: unknown; image?: AdminProductImageInput }> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    throw new AdminProductValidationError(
      "image",
      "La imagen debe pesar como máximo 5 MB.",
    );
  }

  const formData = await request.formData();
  const productValue = formData.get("product");
  if (
    typeof productValue !== "string" ||
    productValue.length < 2 ||
    productValue.length > MAX_PRODUCT_JSON_BYTES
  ) {
    throw new AdminProductValidationError(
      "product",
      "Los datos del producto no son válidos.",
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(productValue) as unknown;
  } catch {
    throw new AdminProductValidationError(
      "product",
      "Los datos del producto no contienen JSON válido.",
    );
  }

  const imageValue = formData.get("image");
  if (!(imageValue instanceof File) || imageValue.size === 0) {
    if (imageRequired) {
      throw new AdminProductValidationError(
        "image",
        "Selecciona una imagen para el producto.",
      );
    }
    return { value };
  }

  if (
    imageValue.size > MAX_ADMIN_PRODUCT_IMAGE_BYTES ||
    !isAcceptedProductImageMimeType(imageValue.type)
  ) {
    throw new AdminProductValidationError(
      "image",
      "Usa una imagen JPEG, PNG o WebP de máximo 5 MB.",
    );
  }
  const bytes = Buffer.from(await imageValue.arrayBuffer());
  validateProductImageBytes(imageValue.type, bytes);
  return { value, image: { mimeType: imageValue.type, bytes } };
}

function parseUpdateValue(value: unknown): {
  expectedUpdatedAt: string;
  patch: AdminProductPatch;
} {
  if (!isRecord(value)) {
    throw new AdminProductValidationError(
      "product",
      "Los cambios del producto no son válidos.",
    );
  }
  const expectedUpdatedAt = value.expectedUpdatedAt;
  if (
    typeof expectedUpdatedAt !== "string" ||
    !Number.isFinite(Date.parse(expectedUpdatedAt))
  ) {
    throw new AdminProductValidationError(
      "expectedUpdatedAt",
      "La versión del producto no es válida.",
    );
  }
  const normalized = normalizeAdminProductPatch(value.patch);
  return { expectedUpdatedAt, patch: normalized };
}

function repositoryErrorResponse(error: AdminProductRepositoryError): Response {
  if (error.code === "PRODUCT_NOT_FOUND") {
    return errorResponse(404, error.message);
  }
  if (
    error.code === "PRODUCT_ALREADY_EXISTS" ||
    error.code === "STALE_PRODUCT" ||
    error.code === "PRODUCT_ARCHIVED"
  ) {
    return errorResponse(
      409,
      error.message,
      error.code === "PRODUCT_ALREADY_EXISTS" ? { name: error.message } : {},
    );
  }
  return errorResponse(400, error.message, { primaryCategoryId: error.message });
}

export async function createAdminProductResponse(
  request: Request,
  session: AdministratorSession,
): Promise<Response> {
  if (!session) {
    return errorResponse(401, "La sesión administrativa no es válida.");
  }
  try {
    const { value, image } = await readMultipartProduct(request, true);
    const input = normalizeAdminProductCreate(value);
    if (!image) {
      throw new AdminProductValidationError(
        "image",
        "Selecciona una imagen para el producto.",
      );
    }
    const product = await createAdminProduct(input, image);
    return Response.json(
      { product },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error: unknown) {
    if (error instanceof AdminProductValidationError) {
      return errorResponse(400, error.message, { [error.field]: error.message });
    }
    if (error instanceof AdminProductRepositoryError) {
      return repositoryErrorResponse(error);
    }
    return errorResponse(500, "No fue posible crear el producto.");
  }
}

export async function updateAdminProductResponse(
  request: Request,
  productId: string,
  session: AdministratorSession,
): Promise<Response> {
  if (!session) {
    return errorResponse(401, "La sesión administrativa no es válida.");
  }
  if (!isProductId(productId)) {
    return errorResponse(404, "El producto no existe.");
  }
  try {
    const { value, image } = await readMultipartProduct(request, false);
    const parsed = parseUpdateValue(value);
    const product = await updateAdminProduct(
      {
        productId,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        patch: parsed.patch,
      },
      image,
    );
    return Response.json({ product }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof AdminProductValidationError) {
      return errorResponse(400, error.message, { [error.field]: error.message });
    }
    if (error instanceof AdminProductRepositoryError) {
      return repositoryErrorResponse(error);
    }
    return errorResponse(500, "No fue posible guardar el producto.");
  }
}
