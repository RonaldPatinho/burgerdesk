import assert from "node:assert/strict";
import test from "node:test";
import type { Product } from "../../domain/models";
import {
  buildCanonicalCheckout,
  CheckoutValidationError,
} from "./canonical-order";
import type { CheckoutRequestInput } from "./types";

const dynamicProduct: Product = {
  id: "producto-dinamico",
  name: "Producto dinámico",
  summary: "Persistido en MySQL",
  priceCop: 20_000,
  imagePath: "/images/products/la_bendita.png",
  categoryIds: ["burgers"],
  available: true,
  options: [
    {
      id: "extra-dinamico",
      name: "Extra dinámico",
      priceCop: 2_000,
      available: true,
    },
  ],
  defaultOptionIds: [],
};

function request(productId = dynamicProduct.id): CheckoutRequestInput {
  return {
    requestId: "request-a5-catalog-123",
    paymentMethod: "efectivo",
    termsAccepted: true,
    clientSession: { sessionId: "session-a5", clientId: null },
    cart: {
      items: [
        {
          productId,
          optionIds: productId === dynamicProduct.id ? ["extra-dinamico"] : [],
          quantity: 1,
        },
      ],
      kitchenNote: "",
    },
    retryOrderId: null,
    catalogSnapshot: {
      products: [dynamicProduct],
      pickupStore: {
        id: "sede-centro",
        name: "Sede Centro",
        pickupEstimateMinutes: [15, 20],
      },
    },
  };
}

test("checkout usa el snapshot persistente para productos dinámicos y precios canónicos", () => {
  const canonical = buildCanonicalCheckout(request());

  assert.equal(canonical.draft.lines[0]?.productId, "producto-dinamico");
  assert.equal(canonical.draft.lines[0]?.unitBasePriceCop, 20_000);
  assert.equal(canonical.draft.lines[0]?.unitPriceCop, 22_000);
  assert.equal(canonical.draft.subtotalCop, 22_000);
  assert.equal(canonical.draft.totalCop, 24_900);
});

test("un snapshot persistente no cae al seed provisional ante un producto ausente", () => {
  assert.throws(
    () => buildCanonicalCheckout(request("la-bendita")),
    (error: unknown) =>
      error instanceof CheckoutValidationError &&
      error.code === "CART_INVALID",
  );
});

test("checkout conserva complementos de una burger distinta a La Bendita", () => {
  const canonical = buildCanonicalCheckout({
    requestId: "request-standard-burger-123",
    paymentMethod: "efectivo",
    termsAccepted: true,
    clientSession: { sessionId: "session-standard-burger", clientId: null },
    cart: {
      items: [
        {
          productId: "doble-pecado",
          optionIds: ["cheddar-extra", "tocineta", "salsa-incluida"],
          quantity: 2,
        },
      ],
      kitchenNote: "",
    },
    retryOrderId: null,
  });

  assert.equal(canonical.draft.lines[0]?.unitBasePriceCop, 34_900);
  assert.equal(canonical.draft.lines[0]?.unitPriceCop, 42_900);
  assert.equal(canonical.draft.lines[0]?.lineTotalCop, 85_800);
  assert.deepEqual(canonical.draft.lines[0]?.options, [
    {
      optionId: "cheddar-extra",
      optionName: "Cheddar extra",
      priceCop: 3_500,
    },
    { optionId: "salsa-incluida", optionName: "Salsa incluida", priceCop: 0 },
    { optionId: "tocineta", optionName: "Tocineta", priceCop: 4_500 },
  ]);
  assert.equal(canonical.draft.subtotalCop, 85_800);
  assert.equal(canonical.draft.totalCop, 88_700);
});
