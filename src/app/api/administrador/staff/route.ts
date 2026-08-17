import { createAdminStaffResponse } from "@/server/internal-auth/admin-staff-response";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await getAuthenticatedAdministratorSession();
  return createAdminStaffResponse(request, session);
}
