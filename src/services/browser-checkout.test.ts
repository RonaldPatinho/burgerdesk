import assert from "node:assert/strict";
import test from "node:test";
import type { Cart } from "../domain/models";
import { clientStorageKeys } from "../domain/persistence";
import {
  BrowserCheckoutRepository,
  shouldClearCartAfterConfirmation,
  type CheckoutStoragePort,
} from "./browser-checkout";

function storage(): CheckoutStoragePort & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const cart: Cart = {
  items: [
    {
      id: "line-1",
      productId: "la-bendita",
      optionIds: ["cheddar-extra"],
      quantity: 1,
    },
  ],
  kitchenNote: "",
};

test("reutiliza la solicitud para doble envio del mismo carrito", () => {
  const target = storage();
  let nextId = 0;
  const repository = new BrowserCheckoutRepository({
    getStorage: () => target,
    createId: () => `request-${String(++nextId).padStart(9, "0")}`,
    now: () => "2026-08-05T12:00:00.000Z",
  });

  const first = repository.begin({ cart, paymentMethod: "stripe" });
  const second = repository.begin({ cart, paymentMethod: "stripe" });
  assert.equal(first.requestId, second.requestId);
  assert.equal(nextId, 1);
});

test("un reintento terminal conserva el pedido y crea otra solicitud", () => {
  const target = storage();
  let nextId = 0;
  const repository = new BrowserCheckoutRepository({
    getStorage: () => target,
    createId: () => `request-${String(++nextId).padStart(9, "0")}`,
  });
  repository.begin({ cart, paymentMethod: "stripe" });
  repository.associate({ orderId: "order-1", checkoutSessionId: "cs_test_1" });

  const retry = repository.begin({
    cart,
    paymentMethod: "stripe",
    forceNewAttempt: true,
  });
  assert.equal(retry.retryOrderId, "order-1");
  assert.equal(retry.requestId, "request-000000002");
});

test("solo permite vaciar el carrito confirmado si coincide con lo enviado", () => {
  assert.equal(
    shouldClearCartAfterConfirmation({
      cartCanBeCleared: false,
      currentCart: cart,
      submittedCart: cart,
    }),
    false,
  );
  assert.equal(
    shouldClearCartAfterConfirmation({
      cartCanBeCleared: true,
      currentCart: cart,
      submittedCart: cart,
    }),
    true,
  );
  assert.equal(
    shouldClearCartAfterConfirmation({
      cartCanBeCleared: true,
      currentCart: {
        ...cart,
        items: [{ ...cart.items[0], quantity: 2 }],
      },
      submittedCart: cart,
    }),
    false,
  );
});

test("completar checkout elimina solo su estado auxiliar", () => {
  const target = storage();
  target.setItem(clientStorageKeys.cart, "carrito-conservado");
  target.setItem(clientStorageKeys.session, "sesion-conservada");
  const repository = new BrowserCheckoutRepository({
    getStorage: () => target,
    createId: () => "request-1234567890",
  });
  repository.begin({ cart, paymentMethod: "efectivo" });

  repository.complete();

  assert.equal(target.getItem(clientStorageKeys.checkout), null);
  assert.equal(target.getItem(clientStorageKeys.cart), "carrito-conservado");
  assert.equal(target.getItem(clientStorageKeys.session), "sesion-conservada");
});
