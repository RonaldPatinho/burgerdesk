import {
  isAdministratorFinancialPeriodKind,
  type AdministratorFinancialSnapshot,
  type AdministratorFinancialPeriodKind,
} from "./admin-finance";

const reportDateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function normalizeAdministratorReportPeriod(
  value: unknown,
): AdministratorFinancialPeriodKind {
  return isAdministratorFinancialPeriodKind(value) ? value : "day";
}

export function buildAdministratorReportsHref(
  periodKind: AdministratorFinancialPeriodKind,
): string {
  return periodKind === "month"
    ? "/administrador/reportes?period=month"
    : "/administrador/reportes";
}

export function administratorReportFileName(input: {
  periodKind: AdministratorFinancialPeriodKind;
  periodKey: string;
}): string {
  const periodLabel = input.periodKind === "day" ? "dia" : "mes";
  return `burgerdesk-reporte-${periodLabel}-${input.periodKey}.csv`;
}

export function administratorReportUpdatedLabel(
  updatedAt: string,
  timeZone: string,
): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("La fecha de actualización no es válida.");
  }
  let formatter = reportDateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("es-CO", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    });
    reportDateTimeFormatters.set(timeZone, formatter);
  }
  return formatter.format(date);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createAdministratorReportCsv(
  snapshot: AdministratorFinancialSnapshot,
  updatedAt: string,
): string {
  const updatedDate = new Date(updatedAt);
  if (Number.isNaN(updatedDate.getTime())) {
    throw new RangeError("La fecha de exportación no es válida.");
  }
  const periodLabel = snapshot.period.kind === "day" ? "dia" : "mes";
  const rows: Array<Array<string | number>> = [
    [
      "seccion",
      "periodo",
      "clave",
      "etiqueta",
      "ventas_cop",
      "pedidos",
      "cantidad_vendida",
      "producto_id",
      "actualizado_en",
    ],
    [
      "resumen",
      periodLabel,
      snapshot.period.key,
      "Ventas pagadas",
      snapshot.summary.paidSalesCop,
      snapshot.summary.paidOrderCount,
      "",
      "",
      updatedDate.toISOString(),
    ],
    ...snapshot.salesSeries.map((point) => [
      "serie",
      periodLabel,
      point.key,
      point.label,
      point.salesCop,
      point.orderCount,
      "",
      "",
      updatedDate.toISOString(),
    ]),
    ...snapshot.topProducts.map((product, index) => [
      "ranking",
      periodLabel,
      String(index + 1),
      product.productName,
      product.salesCop,
      "",
      product.quantitySold,
      product.productId,
      updatedDate.toISOString(),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
