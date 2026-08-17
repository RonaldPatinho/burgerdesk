import type { Metadata } from "next";
import { AdminReportsScreen } from "@/components/admin/AdminReportsScreen";
import { resolveAdministratorFinancialPeriod } from "@/domain/admin-finance";
import {
  administratorReportFileName,
  normalizeAdministratorReportPeriod,
} from "@/domain/admin-reports";
import { getAdministratorFinancialSnapshot } from "@/server/admin-finance/repository";

export const metadata: Metadata = {
  title: "Reportes",
  description: "Reportes administrativos de ventas pagadas de BurgerDesk.",
};

export const dynamic = "force-dynamic";

export default async function AdministratorReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const periodKind = normalizeAdministratorReportPeriod(
    typeof params.period === "string" ? params.period : undefined,
  );
  const snapshot = await getAdministratorFinancialSnapshot({
    periodKind,
    now,
    rankingLimit: 5,
  });
  const fileNames = {
    day: administratorReportFileName({
      periodKind: "day",
      periodKey: resolveAdministratorFinancialPeriod({ kind: "day", now }).key,
    }),
    month: administratorReportFileName({
      periodKind: "month",
      periodKey: resolveAdministratorFinancialPeriod({ kind: "month", now }).key,
    }),
  } as const;

  return (
    <AdminReportsScreen
      snapshot={snapshot}
      updatedAt={now.toISOString()}
      fileNames={fileNames}
    />
  );
}
