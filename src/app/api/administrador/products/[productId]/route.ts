import {
  archiveAdminProductResponse,
  setAdminProductAvailabilityResponse,
  updateAdminProductResponse,
} from "@/server/catalog/admin-product-response";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> },
): Promise<Response> {
  const [session, { productId }] = await Promise.all([
    getAuthenticatedAdministratorSession(),
    context.params,
  ]);
  if (request.headers.get("content-type")?.includes("application/json")) {
    return setAdminProductAvailabilityResponse(request, productId, session);
  }
  return updateAdminProductResponse(request, productId, session);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ productId: string }> },
): Promise<Response> {
  const [session, { productId }] = await Promise.all([
    getAuthenticatedAdministratorSession(),
    context.params,
  ]);
  return archiveAdminProductResponse(request, productId, session);
}
