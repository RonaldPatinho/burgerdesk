import { createAdminProductResponse } from "@/server/catalog/admin-product-response";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await getAuthenticatedAdministratorSession();
  return createAdminProductResponse(request, session);
}
