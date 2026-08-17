import assert from "node:assert/strict";
import test from "node:test";
import type { AdministratorFinancialSnapshot } from "./admin-finance";
import {
  administratorReportFileName,
  buildAdministratorReportsHref,
  createAdministratorReportCsv,
  normalizeAdministratorReportPeriod,
} from "./admin-reports";

const snapshot: AdministratorFinancialSnapshot = {
  period: {
    kind: "day",
    timeZone: "America/Caracas",
    key: "2026-08-16",
    previousKey: "2026-08-15",
    startAt: "2026-08-16T04:00:00.000Z",
    endAt: "2026-08-17T04:00:00.000Z",
    previousStartAt: "2026-08-15T04:00:00.000Z",
    previousEndAt: "2026-08-16T04:00:00.000Z",
  },
  summary: {
    paidSalesCop: 52_300,
    paidOrderCount: 2,
    confirmedOrderCount: 3,
    averageTicketCop: 26_150,
    previousPaidSalesCop: 0,
    salesVariationPercent: null,
  },
  salesSeries: [
    { key: "2026-08-16T12", label: "12:00", salesCop: 52_300, orderCount: 2 },
  ],
  topProducts: [
    {
      productId: "burger-historica",
      productName: 'Burger; "Especial"\nhistórica',
      quantitySold: 2,
      salesCop: 52_300,
    },
  ],
};

test("normaliza período, enlaces y nombre del archivo", () => {
  assert.equal(normalizeAdministratorReportPeriod("month"), "month");
  assert.equal(normalizeAdministratorReportPeriod("year"), "day");
  assert.equal(buildAdministratorReportsHref("day"), "/administrador/reportes");
  assert.equal(
    buildAdministratorReportsHref("month"),
    "/administrador/reportes?period=month",
  );
  assert.equal(
    administratorReportFileName({
      periodKind: "day",
      periodKey: "2026-08-16",
    }),
    "burgerdesk-reporte-dia-2026-08-16.csv",
  );
});

test("genera CSV UTF-8 separado por punto y coma para Excel y escapa nombres históricos", () => {
  const csv = createAdministratorReportCsv(
    snapshot,
    "2026-08-16T18:30:00.000Z",
  );
  assert.ok(csv.startsWith("\uFEFFseccion;periodo;clave;etiqueta;ventas_cop"));
  assert.match(csv, /resumen;dia;2026-08-16;Ventas pagadas;52300;2/);
  assert.match(csv, /serie;dia;2026-08-16T12;12:00;52300;2/);
  assert.match(csv, /"Burger; ""Especial""\nhistórica";52300;;2;burger-historica/);
  assert.equal(csv.split("\r\n")[0]?.split(";").length, 9);
  assert.ok(!csv.includes("$52.300"));
});
