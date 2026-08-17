import {
  AdminStaffValidationError,
  normalizeAdminStaffCreate,
  normalizeAdminStaffUpdate,
} from "../../domain/admin-staff";
import type { AuthenticatedAdministratorSession } from "./repository";
import {
  AdminStaffRepositoryError,
  createAdminStaffMember,
  updateAdminStaffMember,
} from "./admin-staff-repository";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
type AdministratorSession = AuthenticatedAdministratorSession | null;

function errorResponse(
  status: number,
  message: string,
  errors?: Record<string, string>,
): Response {
  return Response.json(
    { message, ...(errors ? { errors } : {}) },
    { status, headers: NO_STORE_HEADERS },
  );
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AdminStaffValidationError(
      "staff",
      "La solicitud no contiene datos válidos.",
    );
  }
}

function repositoryErrorResponse(error: AdminStaffRepositoryError): Response {
  if (error.code === "STAFF_NOT_FOUND") return errorResponse(404, error.message);
  if (
    error.code === "STALE_STAFF" ||
    error.code === "USERNAME_ALREADY_EXISTS" ||
    error.code === "EMAIL_ALREADY_EXISTS"
  ) {
    return errorResponse(409, error.message);
  }
  return errorResponse(500, "No fue posible actualizar el Personal.");
}

export async function createAdminStaffResponse(
  request: Request,
  session: AdministratorSession,
): Promise<Response> {
  if (!session) return errorResponse(401, "La sesión administrativa no es válida.");
  try {
    const input = normalizeAdminStaffCreate(await readJson(request));
    const staff = await createAdminStaffMember(input);
    return Response.json({ staff }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof AdminStaffValidationError) {
      return errorResponse(400, error.message, { [error.field]: error.message });
    }
    if (error instanceof AdminStaffRepositoryError) {
      return repositoryErrorResponse(error);
    }
    return errorResponse(500, "No fue posible crear la cuenta de Personal.");
  }
}

export async function updateAdminStaffResponse(
  request: Request,
  userId: string,
  session: AdministratorSession,
): Promise<Response> {
  if (!session) return errorResponse(401, "La sesión administrativa no es válida.");
  try {
    const value = await readJson(request);
    const input = normalizeAdminStaffUpdate(userId, value);
    const staff = await updateAdminStaffMember(input);
    return Response.json({ staff }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof AdminStaffValidationError) {
      return errorResponse(400, error.message, { [error.field]: error.message });
    }
    if (error instanceof AdminStaffRepositoryError) {
      return repositoryErrorResponse(error);
    }
    return errorResponse(500, "No fue posible actualizar la cuenta de Personal.");
  }
}
