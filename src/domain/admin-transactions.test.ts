import assert from "node:assert/strict";
import test from "node:test";

import {
  administratorTransactionDateLabel,
  administratorTransactionFilterCount,
  administratorTransactionPaymentMethodLabel,
  administratorTransactionPaymentStatusLabel,
  administratorTransactionPaymentStatusTone,
  administratorTransactionRangeLabel,
  buildAdministratorTransactionsHref,
} from "./admin-transactions";

const baseState = {
  periodKind: "day" as const,
  page: 1,
  search: "",
  paymentMethod: "all" as const,
  paymentStatus: "all" as const,
};

test("presenta métodos y estados persistidos sin inventar canales de pago", () => {
  assert.equal(administratorTransactionPaymentMethodLabel("stripe"), "Pago en línea");
  assert.equal(administratorTransactionPaymentMethodLabel("efectivo"), "Efectivo");
  assert.equal(administratorTransactionPaymentStatusLabel("pagado"), "Pedido pagado");
  assert.equal(
    administratorTransactionPaymentStatusLabel("pendiente_en_efectivo"),
    "Pendiente en efectivo",
  );
  assert.equal(administratorTransactionPaymentStatusTone("pagado"), "paid");
  assert.equal(administratorTransactionPaymentStatusTone("pendiente"), "pending");
  assert.equal(administratorTransactionPaymentStatusTone("fallido"), "danger");
});

test("formatea hora diaria y fecha mensual en la zona del negocio", () => {
  const transactionAt = "2026-08-06T16:42:00.000Z";
  assert.equal(
    administratorTransactionDateLabel({
      transactionAt,
      periodKind: "day",
      timeZone: "America/Caracas",
    }),
    "12:42",
  );

  const monthly = administratorTransactionDateLabel({
    transactionAt,
    periodKind: "month",
    timeZone: "America/Caracas",
  });
  assert.match(monthly, /6/);
  assert.match(monthly.toLowerCase(), /ago/);
  assert.match(monthly, /12:42/);
});

test("construye enlaces conservando filtros y reiniciando la página cuando se solicita", () => {
  const href = buildAdministratorTransactionsHref(
    {
      ...baseState,
      periodKind: "month",
      page: 3,
      search: "bd-abcd1234",
      paymentMethod: "stripe",
      paymentStatus: "pagado",
    },
    { page: 1, periodKind: "day" },
  );

  assert.equal(
    href,
    "/administrador/transacciones?q=bd-abcd1234&method=stripe&status=pagado",
  );
  assert.equal(buildAdministratorTransactionsHref(baseState), "/administrador/transacciones");
});

test("resume filtros activos y el rango visible de la paginación", () => {
  assert.equal(administratorTransactionFilterCount(baseState), 0);
  assert.equal(
    administratorTransactionFilterCount({
      search: "abcd",
      paymentMethod: "efectivo",
      paymentStatus: "pagado",
    }),
    3,
  );
  assert.equal(
    administratorTransactionRangeLabel({ page: 2, pageSize: 6, totalItems: 14 }),
    "7–12 de 14",
  );
  assert.equal(
    administratorTransactionRangeLabel({ page: 1, pageSize: 6, totalItems: 0 }),
    "0 transacciones",
  );
});
