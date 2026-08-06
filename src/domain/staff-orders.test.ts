import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStaffOrderIndicators,
  filterStaffOrders,
  isOperationalOrderStatus,
  isStaffInboxFilter,
  staffOrderCode,
  staffOrderStatusLabel,
  type StaffOrderInboxItem,
} from "./staff-orders";

const orders: StaffOrderInboxItem[] = [
  {
    id: "11111111-2222-3333-4444-555555555555",
    code: "BD-11111111",
    createdAt: "2026-08-06T13:51:00.000Z",
    operationalStatus: "recibido",
    totalCop: 40_300,
    lineCount: 2,
    itemCount: 2,
    firstProductId: "la-bendita",
    firstProductName: "La Bendita",
    fulfillmentLabel: "Retiro",
  },
  {
    id: "22222222-3333-4444-5555-666666666666",
    code: "BD-22222222",
    createdAt: "2026-08-06T13:45:00.000Z",
    operationalStatus: "en_preparacion",
    totalCop: 30_700,
    lineCount: 2,
    itemCount: 3,
    firstProductId: "doble-pecado",
    firstProductName: "Doble Pecado",
    fulfillmentLabel: "Retiro",
  },
  {
    id: "33333333-4444-5555-6666-777777777777",
    code: "BD-33333333",
    createdAt: "2026-08-06T13:41:00.000Z",
    operationalStatus: "listo_para_retirar",
    totalCop: 32_800,
    lineCount: 1,
    itemCount: 2,
    firstProductId: "combo-gloria",
    firstProductName: "Combo Gloria",
    fulfillmentLabel: "Retiro",
  },
];

test("reconoce únicamente estados operativos y filtros documentados", () => {
  assert.equal(isOperationalOrderStatus("recibido"), true);
  assert.equal(isOperationalOrderStatus("confirmado"), false);
  assert.equal(isStaffInboxFilter("preparacion"), true);
  assert.equal(isStaffInboxFilter("listos"), false);
});

test("presenta etiquetas operativas comprensibles", () => {
  assert.equal(staffOrderStatusLabel("recibido"), "Nuevo");
  assert.equal(staffOrderStatusLabel("en_preparacion"), "Preparando");
  assert.equal(staffOrderStatusLabel("listo_para_retirar"), "Listo");
  assert.equal(staffOrderStatusLabel("entregado"), "Entregado");
  assert.equal(staffOrderStatusLabel("cancelado"), "Cancelado");
});

test("genera el código visible sin exponer el UUID completo", () => {
  assert.equal(
    staffOrderCode("ab12cd34-2222-3333-4444-555555555555"),
    "BD-AB12CD34",
  );
});

test("calcula indicadores rápidos desde la fuente de pedidos", () => {
  assert.deepEqual(calculateStaffOrderIndicators(orders), {
    nuevos: 1,
    preparacion: 1,
    listos: 1,
  });
});

test("filtra nuevos y agrupa preparación con pedidos listos", () => {
  assert.deepEqual(
    filterStaffOrders(orders, "nuevos").map((order) => order.operationalStatus),
    ["recibido"],
  );
  assert.deepEqual(
    filterStaffOrders(orders, "preparacion").map(
      (order) => order.operationalStatus,
    ),
    ["en_preparacion", "listo_para_retirar"],
  );
  assert.equal(filterStaffOrders(orders, "todos").length, 3);
});
