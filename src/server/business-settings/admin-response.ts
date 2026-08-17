import {
  BusinessSettingsValidationError,
  DEFAULT_BUSINESS_SETTINGS_STORE_ID,
  normalizeBusinessSettingsUpdateRequest,
} from "../../domain/business-settings";
import {
  BusinessSettingsRepositoryError,
  getBusinessSettings,
  updateBusinessSettings,
} from "./repository";

const MAX_SETTINGS_JSON_BYTES = 8_192;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

type AdministratorSession = { userId: string } | null;

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

function repositoryErrorResponse(
  error: BusinessSettingsRepositoryError,
): Response {
  return error.code === "STALE_SETTINGS"
    ? errorResponse(409, error.message)
    : errorResponse(404, error.message);
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_SETTINGS_JSON_BYTES
  ) {
    throw new BusinessSettingsValidationError(
      "settings",
      "La solicitud de configuración es demasiado grande.",
    );
  }
  const text = await request.text();
  if (text.length < 2 || text.length > MAX_SETTINGS_JSON_BYTES) {
    throw new BusinessSettingsValidationError(
      "settings",
      "La solicitud de configuración no es válida.",
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BusinessSettingsValidationError(
      "settings",
      "La solicitud no contiene JSON válido.",
    );
  }
}

export async function getAdminBusinessSettingsResponse(
  session: AdministratorSession,
): Promise<Response> {
  if (!session) {
    return errorResponse(401, "La sesión administrativa no es válida.");
  }
  try {
    const settings = await getBusinessSettings();
    if (!settings) {
      return errorResponse(404, "No encontramos la configuración del local.");
    }
    return Response.json({ settings }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof BusinessSettingsRepositoryError) {
      return repositoryErrorResponse(error);
    }
    return errorResponse(500, "No fue posible consultar la configuración.");
  }
}

export async function updateAdminBusinessSettingsResponse(
  request: Request,
  session: AdministratorSession,
): Promise<Response> {
  if (!session) {
    return errorResponse(401, "La sesión administrativa no es válida.");
  }
  try {
    const normalized = normalizeBusinessSettingsUpdateRequest(
      await readJson(request),
    );
    const settings = await updateBusinessSettings({
      storeId: DEFAULT_BUSINESS_SETTINGS_STORE_ID,
      ...normalized,
    });
    return Response.json({ settings }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof BusinessSettingsValidationError) {
      return errorResponse(400, error.message, {
        [error.field]: error.message,
      });
    }
    if (error instanceof BusinessSettingsRepositoryError) {
      return repositoryErrorResponse(error);
    }
    return errorResponse(500, "No fue posible guardar la configuración.");
  }
}
