import assert from "node:assert/strict";
import test from "node:test";
import { CheckoutRequestError, parseCheckoutRequest } from "./request";

function validBody(): Record<string, unknown> {
  return {
    requestId: "request-1234567890",
    paymentMethod: "stripe",
    termsAccepted: true,
    clientSession: {
      sessionId: "session-123",
      clientId: null,
    },
    cart: {
      items: [
        {
          productId: "la-bendita",
          optionIds: ["cheddar-extra"],
          quantity: 1,
        },
      ],
      kitchenNote: "Sin cebolla",
    },
    retryOrderId: null,
  };
}

test("acepta solo identificadores y cantidades del carrito", () => {
  const parsed = parseCheckoutRequest(validBody());

  assert.equal(parsed.paymentMethod, "stripe");
  assert.deepEqual(parsed.cart.items, [
    {
      productId: "la-bendita",
      optionIds: ["cheddar-extra"],
      quantity: 1,
    },
  ]);
});

test("rechaza moneda, precio o total enviados por el navegador", () => {
  for (const manipulated of [
    { ...validBody(), currency: "usd" },
    { ...validBody(), totalCop: 1 },
    {
      ...validBody(),
      cart: {
        items: [
          {
            productId: "la-bendita",
            optionIds: [],
            quantity: 1,
            priceCop: 1,
          },
        ],
        kitchenNote: "",
      },
    },
  ]) {
    assert.throws(
      () => parseCheckoutRequest(manipulated),
      (error: unknown) =>
        error instanceof CheckoutRequestError &&
        error.code === "UNEXPECTED_FINANCIAL_DATA",
    );
  }
});

test("acepta ids dinámicos bien formados y rechaza identificadores inseguros", () => {
  const dynamicBody = validBody();
  dynamicBody.cart = {
    items: [
      {
        productId: "producto-dinamico",
        optionIds: ["extra-dinamico"],
        quantity: 1,
      },
    ],
    kitchenNote: "",
  };

  const parsed = parseCheckoutRequest(dynamicBody);
  assert.equal(parsed.cart.items[0]?.productId, "producto-dinamico");

  const invalidBody = validBody();
  invalidBody.cart = {
    items: [
      {
        productId: "../producto",
        optionIds: [],
        quantity: 1,
      },
    ],
    kitchenNote: "",
  };

  assert.throws(
    () => parseCheckoutRequest(invalidBody),
    (error: unknown) =>
      error instanceof CheckoutRequestError &&
      error.code === "INVALID_PRODUCT",
  );
});

test("requiere aceptar terminos y una cantidad valida", () => {
  assert.throws(() =>
    parseCheckoutRequest({ ...validBody(), termsAccepted: false }),
  );
  const body = validBody();
  body.cart = {
    items: [
      {
        productId: "la-bendita",
        optionIds: [],
        quantity: 0,
      },
    ],
    kitchenNote: "",
  };
  assert.throws(() => parseCheckoutRequest(body));
});
