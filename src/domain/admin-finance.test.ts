import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAdministratorAverageTicket,
  calculateAdministratorVariationPercent,
  createAdministratorSalesSeries,
  isAdministratorFinancialPeriodKind,
  isAdministratorPaymentMethodFilter,
  isAdministratorPaymentStatusFilter,
  normalizeAdministratorTransactionQuery,
  resolveAdministratorFinancialPeriod,
} from "./admin-finance";

test("resuelve el día del negocio en America/Caracas y su período anterior", () => {
  const period = resolveAdministratorFinancialPeriod({
    kind: "day",
    now: new Date("2026-08-06T16:30:00.000Z"),
  });

  assert.equal(period.key, "2026-08-06");
  assert.equal(period.previousKey, "2026-08-05");
  assert.equal(period.startAt, "2026-08-06T04:00:00.000Z");
  assert.equal(period.endAt, "2026-08-07T04:00:00.000Z");
  assert.equal(period.previousStartAt, "2026-08-05T04:00:00.000Z");
  assert.equal(period.previousEndAt, "2026-08-06T04:00:00.000Z");
});

test("resuelve el mes actual y anterior sin depender de la zona del equipo", () => {
  const period = resolveAdministratorFinancialPeriod({
    kind: "month",
    now: new Date("2026-03-01T02:00:00.000Z"),
  });

  assert.equal(period.key, "2026-02");
  assert.equal(period.previousKey, "2026-01");
  assert.equal(period.startAt, "2026-02-01T04:00:00.000Z");
  assert.equal(period.endAt, "2026-03-01T04:00:00.000Z");
  assert.equal(period.previousStartAt, "2026-01-01T04:00:00.000Z");
});

test("las guardas aceptan únicamente períodos y filtros documentados", () => {
  assert.equal(isAdministratorFinancialPeriodKind("day"), true);
  assert.equal(isAdministratorFinancialPeriodKind("week"), false);
  assert.equal(isAdministratorPaymentMethodFilter("stripe"), true);
  assert.equal(isAdministratorPaymentMethodFilter("tarjeta"), false);
  assert.equal(isAdministratorPaymentStatusFilter("pendiente_en_efectivo"), true);
  assert.equal(isAdministratorPaymentStatusFilter("reembolsado"), false);
});

test("normaliza paginación, búsqueda y filtros sin aceptar valores libres", () => {
  const query = normalizeAdministratorTransactionQuery({
    periodKind: "month",
    page: "2",
    pageSize: 500,
    search: "  ABC-123  ",
    paymentMethod: "tarjeta",
    paymentStatus: "pagado",
    storeId: " sede-principal ",
    now: new Date("2026-08-06T16:30:00.000Z"),
  });

  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 50);
  assert.equal(query.search, "abc-123");
  assert.equal(query.paymentMethod, "all");
  assert.equal(query.paymentStatus, "pagado");
  assert.equal(query.storeId, "sede-principal");
  assert.equal(query.period.kind, "month");
});

test("evita divisiones inválidas en variación y ticket promedio", () => {
  assert.equal(calculateAdministratorVariationPercent(10_000, 0), null);
  assert.equal(calculateAdministratorVariationPercent(12_500, 10_000), 25);
  assert.equal(calculateAdministratorAverageTicket(0, 0), 0);
  assert.equal(calculateAdministratorAverageTicket(30_001, 2), 15_001);
});

test("genera 24 puntos horarios y acumula ventas en la hora local correcta", () => {
  const period = resolveAdministratorFinancialPeriod({
    kind: "day",
    now: new Date("2026-08-06T16:30:00.000Z"),
  });
  const series = createAdministratorSalesSeries(period, [
    { occurredAt: "2026-08-06T04:15:00.000Z", totalCop: 10_000 },
    { occurredAt: "2026-08-06T04:45:00.000Z", totalCop: 5_000 },
    { occurredAt: "2026-08-06T18:00:00.000Z", totalCop: 8_000 },
  ]);

  assert.equal(series.length, 24);
  assert.deepEqual(series[0], {
    key: "2026-08-06T00",
    label: "00:00",
    salesCop: 15_000,
    orderCount: 2,
  });
  assert.equal(series[14]?.salesCop, 8_000);
  assert.equal(series[14]?.orderCount, 1);
});

test("genera una serie mensual con un punto por cada día real", () => {
  const period = resolveAdministratorFinancialPeriod({
    kind: "month",
    now: new Date("2028-02-15T16:30:00.000Z"),
  });
  const series = createAdministratorSalesSeries(period, [
    { occurredAt: "2028-02-29T16:00:00.000Z", totalCop: 22_000 },
  ]);

  assert.equal(series.length, 29);
  assert.equal(series[28]?.key, "2028-02-29");
  assert.equal(series[28]?.salesCop, 22_000);
});
