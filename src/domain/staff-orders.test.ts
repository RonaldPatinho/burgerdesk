import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStaffOrderIndicators,
  canTransitionOperationalOrderStatus,
  filterStaffOrders,
  isOperationalOrderStatus,
  isStaffInboxFilter,
  nextOperationalOrderStatus,
  staffOrderCode,
  staffOrderStatusLabel,
  staffOrderStatusLongLabel,
  type StaffOrderInboxItem,
} from "./staff-orders";

const orders: StaffOrderInboxItem[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    code: "BD-11111111",
    createdAt: "2026-08-06T12:00:00.000Z",
    operationalStatus: "recibido",
    totalCop: 26_900,
    lineCount: 1,
    itemCount: 1,
    firstProductId: "la-bendita",
    firstProductName: "La Bendita",
    fulfillmentLabel: "Retiro",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    code: "BD-22222222",
    createdAt: "2026-08-06T12:05:00.000Z",
    operationalStatus: "en_preparacion",
    totalCop: 30_700,
    lineCount: 2,
    itemCount: 3,
    firstProductId: "doble-pecado",
    firstProductName: "Doble Pecado",
    fulfillmentLabel: "Retiro",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    code: "BD-33333333",
    createdAt: "2026-08-06T12:10:00.000Z",
    operationalStatus: "listo_para_retirar",
    totalCop: 32_800,
    lineCount: 2,
    itemCount: 2,
    firstProductId: "clasica-90",
    firstProductName: "Clásica 90",
    fulfillmentLabel: "Retiro",
  },
];

test("reconoce únicamente estados operativos y filtros documentados", () => {
  assert.equal(isOperationalOrderStatus("recibido"), true);
  assert.equal(isOperationalOrderStatus("entregado"), true);
  assert.equal(isOperationalOrderStatus("desconocido"), false);
  assert.equal(isStaffInboxFilter("preparacion"), true);
  assert.equal(isStaffInboxFilter("listos"), false);
});

test("presenta etiquetas operativas comprensibles", () => {
  assert.equal(staffOrderStatusLabel("recibido"), "Nuevo");
  assert.equal(staffOrderStatusLabel("en_preparacion"), "Preparando");
  assert.equal(staffOrderStatusLongLabel("listo_para_retirar"), "Listo para retirar");
  assert.equal(staffOrderStatusLongLabel("entregado"), "Entregado");
});

test("genera el código visible sin exponer el UUID completo", () => {
  assert.equal(
    staffOrderCode("00aabbcc-ddee-4411-8899-001122334455"),
    "BD-00AABBCC",
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
    filterStaffOrders(orders, "nuevos").map((order) => order.id),
    [orders[0].id],
  );
  assert.deepEqual(
    filterStaffOrders(orders, "preparacion").map((order) => order.id),
    [orders[1].id, orders[2].id],
  );
  assert.equal(filterStaffOrders(orders, "todos").length, 3);
});

test("define una progresión operativa lineal y segura", () => {
  assert.equal(nextOperationalOrderStatus("recibido"), "en_preparacion");
  assert.equal(
    nextOperationalOrderStatus("en_preparacion"),
    "listo_para_retirar",
  );
  assert.equal(nextOperationalOrderStatus("listo_para_retirar"), "entregado");
  assert.equal(nextOperationalOrderStatus("entregado"), null);
  assert.equal(nextOperationalOrderStatus("cancelado"), null);
});

test("rechaza saltos, retrocesos y cambios desde estados terminales", () => {
  assert.equal(
    canTransitionOperationalOrderStatus("recibido", "en_preparacion"),
    true,
  );
  assert.equal(
    canTransitionOperationalOrderStatus("recibido", "listo_para_retirar"),
    false,
  );
  assert.equal(
    canTransitionOperationalOrderStatus("listo_para_retirar", "en_preparacion"),
    false,
  );
  assert.equal(
    canTransitionOperationalOrderStatus("entregado", "entregado"),
    false,
  );
});
