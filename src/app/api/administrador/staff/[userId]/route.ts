import { updateAdminStaffResponse } from "@/server/internal-auth/admin-staff-response";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const [{ userId }, session] = await Promise.all([
    context.params,
    getAuthenticatedAdministratorSession(),
  ]);
  return updateAdminStaffResponse(request, userId, session);
}
