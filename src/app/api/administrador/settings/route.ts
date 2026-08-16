import {
  getAdminBusinessSettingsResponse,
  updateAdminBusinessSettingsResponse,
} from "@/server/business-settings/admin-response";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await getAuthenticatedAdministratorSession();
  return getAdminBusinessSettingsResponse(session);
}

export async function PATCH(request: Request): Promise<Response> {
  const session = await getAuthenticatedAdministratorSession();
  return updateAdminBusinessSettingsResponse(request, session);
}
