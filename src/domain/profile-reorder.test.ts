import assert from "node:assert/strict";
import test from "node:test";
import { products } from "../data/provisional";
import type { ClientOrderDetailView } from "./profile";
import { buildProfileReorder } from "./profile-reorder";

const order: ClientOrderDetailView = {
  id: "order-1",
  code: "BD-1",
  createdAt: "2026-08-05T12:00:00.000Z",
  status: "confirmed",
  statusLabel: "Pagado",
  productSummary: "La Bendita",
  totalCop: 40_000,
  paymentMethod: "stripe",
  paymentMethodLabel: "Pago en línea con Stripe",
  storeId: "sede-centro",
  storeName: "Sede Centro",
  subtotalCop: 37_100,
  serviceFeeCop: 2_900,
  confirmedAt: "2026-08-05T12:00:00.000Z",
  lines: [
    {
      id: "line-1",
      productId: "la-bendita",
      productName: "La Bendita",
      quantity: 1,
      unitBasePriceCop: 20_000,
      lineTotalCop: 20_000,
      options: [
        { optionId: "cheddar-extra", optionName: "Cheddar extra", priceCop: 1_000 },
        { optionId: "option-retired", optionName: "Extra retirado", priceCop: 500 },
      ],
    },
    {
      id: "line-2",
      productId: "producto-retirado",
      productName: "Producto retirado",
      quantity: 1,
      unitBasePriceCop: 10_000,
      lineTotalCop: 10_000,
      options: [],
    },
  ],
};

test("volver a pedir usa el catálogo actual y reporta omisiones", () => {
  const result = buildProfileReorder(order, products, 10);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0]?.optionIds, ["cheddar-extra"]);
  assert.deepEqual(result.omittedProductNames, ["Producto retirado"]);
  assert.deepEqual(result.omittedOptionNames, ["Extra retirado"]);
  assert.equal(result.priceChanged, true);
});
