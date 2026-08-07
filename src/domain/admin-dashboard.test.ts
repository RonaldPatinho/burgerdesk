import assert from "node:assert/strict";
import test from "node:test";

import type { AdministratorFinancialSnapshot } from "./admin-finance";
import {
  administratorDashboardHasPaidSales,
  administratorDashboardVariationLabel,
  createAdministratorDashboardQuickActions,
} from "./admin-dashboard";

test("los accesos rápidos conservan sus rutas y muestran conteos reales", () => {
  const actions = createAdministratorDashboardQuickActions({
    activeProductCount: 6,
    confirmedOrderCount: 12,
  });

  assert.deepEqual(
    actions.map(({ id, href, detail }) => ({ id, href, detail })),
    [
      {
        id: "products",
        href: "/administrador/productos",
        detail: "6 activos",
      },
      {
        id: "transactions",
        href: "/administrador/transacciones",
        detail: "12 hoy",
      },
      {
        id: "reports",
        href: "/administrador/reportes",
        detail: "Actualizado",
      },
    ],
  );
});

test("la variación presenta aumento, caída, cero y ausencia de comparación", () => {
  assert.equal(administratorDashboardVariationLabel(18), "+18%");
  assert.equal(administratorDashboardVariationLabel(-7.25), "-7,3%");
  assert.equal(administratorDashboardVariationLabel(0), "0%");
  assert.equal(administratorDashboardVariationLabel(null), "Sin comparación");
});

test("el estado vacío depende únicamente de ventas pagadas reales", () => {
  const empty: Pick<
    AdministratorFinancialSnapshot,
    "summary" | "salesSeries"
  > = {
    summary: {
      paidSalesCop: 0,
      paidOrderCount: 0,
      confirmedOrderCount: 0,
      averageTicketCop: 0,
      previousPaidSalesCop: 0,
      salesVariationPercent: null,
    },
    salesSeries: [
      { key: "a", label: "00:00", salesCop: 0, orderCount: 0 },
      { key: "b", label: "01:00", salesCop: 0, orderCount: 0 },
    ],
  };

  assert.equal(administratorDashboardHasPaidSales(empty), false);
  assert.equal(
    administratorDashboardHasPaidSales({
      ...empty,
      salesSeries: [
        ...empty.salesSeries,
        { key: "c", label: "02:00", salesCop: 20_000, orderCount: 1 },
      ],
    }),
    true,
  );
});
