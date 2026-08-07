import type { AdministratorFinancialSnapshot } from "./admin-finance";

export type AdministratorDashboardQuickActionId =
  | "products"
  | "transactions"
  | "reports";

export interface AdministratorDashboardQuickAction {
  id: AdministratorDashboardQuickActionId;
  label: string;
  href: string;
  detail: string;
}

const dashboardPercentFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function assertCount(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} debe ser un entero no negativo.`);
  }
}

export function createAdministratorDashboardQuickActions(input: {
  activeProductCount: number;
  confirmedOrderCount: number;
}): readonly AdministratorDashboardQuickAction[] {
  assertCount(input.activeProductCount, "activeProductCount");
  assertCount(input.confirmedOrderCount, "confirmedOrderCount");

  return [
    {
      id: "products",
      label: "Productos",
      href: "/administrador/productos",
      detail: `${input.activeProductCount} ${
        input.activeProductCount === 1 ? "activo" : "activos"
      }`,
    },
    {
      id: "transactions",
      label: "Transacciones",
      href: "/administrador/transacciones",
      detail: `${input.confirmedOrderCount} hoy`,
    },
    {
      id: "reports",
      label: "Reportes",
      href: "/administrador/reportes",
      detail: "Actualizado",
    },
  ];
}

export function administratorDashboardVariationLabel(
  variationPercent: number | null,
): string {
  if (variationPercent === null) return "Sin comparación";
  if (!Number.isFinite(variationPercent)) {
    throw new RangeError("La variación debe ser un porcentaje finito.");
  }

  const value = dashboardPercentFormatter.format(Math.abs(variationPercent));

  if (variationPercent > 0) return `+${value}%`;
  if (variationPercent < 0) return `-${value}%`;
  return "0%";
}

export function administratorDashboardHasPaidSales(
  snapshot: Pick<AdministratorFinancialSnapshot, "summary" | "salesSeries">,
): boolean {
  return (
    snapshot.summary.paidSalesCop > 0 ||
    snapshot.salesSeries.some((point) => point.salesCop > 0)
  );
}
