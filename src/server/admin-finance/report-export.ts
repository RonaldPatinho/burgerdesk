import {
  isAdministratorFinancialPeriodKind,
  type AdministratorFinancialPeriodKind,
} from "../../domain/admin-finance";
import {
  administratorReportFileName,
  createAdministratorReportCsv,
} from "../../domain/admin-reports";
import { getAdministratorFinancialSnapshot } from "./repository";

type AdministratorSession = { userId: string } | null;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

function jsonError(status: number, message: string): Response {
  return Response.json(
    { message },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function createAdministratorReportExportResponse(input: {
  session: AdministratorSession;
  periodKind: unknown;
  now?: Date;
}): Promise<Response> {
  if (!input.session) {
    return jsonError(401, "La sesión administrativa no es válida.");
  }
  const periodKind: AdministratorFinancialPeriodKind =
    input.periodKind === null || input.periodKind === undefined
      ? "day"
      : isAdministratorFinancialPeriodKind(input.periodKind)
        ? input.periodKind
        : "day";
  if (
    input.periodKind !== null &&
    input.periodKind !== undefined &&
    !isAdministratorFinancialPeriodKind(input.periodKind)
  ) {
    return jsonError(400, "El período del reporte no es válido.");
  }
  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) {
    return jsonError(400, "La fecha del reporte no es válida.");
  }

  try {
    const snapshot = await getAdministratorFinancialSnapshot({
      periodKind,
      now,
      rankingLimit: 20,
    });
    const updatedAt = now.toISOString();
    const fileName = administratorReportFileName({
      periodKind,
      periodKey: snapshot.period.key,
    });
    return new Response(createAdministratorReportCsv(snapshot, updatedAt), {
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError(500, "No fue posible generar el reporte.");
  }
}
