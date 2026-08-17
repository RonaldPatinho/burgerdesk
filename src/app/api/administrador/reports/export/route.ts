import { createAdministratorReportExportResponse } from "@/server/admin-finance/report-export";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const session = await getAuthenticatedAdministratorSession();
  const periodKind = new URL(request.url).searchParams.get("period");
  return createAdministratorReportExportResponse({ session, periodKind });
}
