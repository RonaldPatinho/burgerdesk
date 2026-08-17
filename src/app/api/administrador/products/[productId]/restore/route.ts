import { restoreAdminProductResponse } from "@/server/catalog/admin-product-response";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ productId: string }> },
): Promise<Response> {
  const [session, { productId }] = await Promise.all([
    getAuthenticatedAdministratorSession(),
    context.params,
  ]);
  return restoreAdminProductResponse(request, productId, session);
}
