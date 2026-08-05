import assert from "node:assert/strict";
import test from "node:test";

import { MAX_QUANTITY_PER_CART_LINE } from "../data/provisional";
import type { Cart } from "../domain/models";
import {
  CLIENT_STORAGE_VERSION,
  clientStorageKeys,
} from "../domain/persistence";
import {
  LocalStorageCartRepository,
  type CartStoragePort,
} from "./browser-cart";

function createStorage(
  entries: Record<string, string> = {},
): CartStoragePort & { values: Map<string, string> } {
  const values = new Map(Object.entries(entries));

  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const sampleCart: Cart = {
  items: [
    {
      id: "la-bendita__cheddar-extra+salsa-incluida",
      productId: "la-bendita",
      optionIds: ["cheddar-extra", "salsa-incluida"],
      quantity: 2,
    },
  ],
  kitchenNote: "",
};

test("un carrito nuevo comienza vacío sin escribir almacenamiento", async () => {
  const storage = createStorage();
  const repository = new LocalStorageCartRepository({
    getStorage: () => storage,
  });

  assert.deepEqual(await repository.getCart(), { items: [], kitchenNote: "" });
  assert.equal(storage.values.size, 0);
});

test("guarda únicamente el esquema versionado del carrito", async () => {
  const storage = createStorage({
    [clientStorageKeys.session]: "sesión-conservada",
  });
  const repository = new LocalStorageCartRepository({
    getStorage: () => storage,
    now: () => "2026-08-04T12:00:00-04:00",
  });

  await repository.saveCart(sampleCart);

  assert.deepEqual(JSON.parse(storage.values.get(clientStorageKeys.cart) ?? ""), {
    version: CLIENT_STORAGE_VERSION,
    cart: sampleCart,
    updatedAt: "2026-08-04T12:00:00-04:00",
  });
  assert.equal(
    storage.values.get(clientStorageKeys.session),
    "sesión-conservada",
  );
});

test("elimina solo un carrito corrupto y conserva las demás claves", async () => {
  const storage = createStorage({
    [clientStorageKeys.cart]: "{incompleto",
    [clientStorageKeys.session]: "sesión-conservada",
  });
  const repository = new LocalStorageCartRepository({
    getStorage: () => storage,
  });

  assert.deepEqual(await repository.getCart(), { items: [], kitchenNote: "" });
  assert.equal(storage.values.has(clientStorageKeys.cart), false);
  assert.equal(
    storage.values.get(clientStorageKeys.session),
    "sesión-conservada",
  );
});

test("rechaza cantidades superiores a la política provisional", async () => {
  const storage = createStorage();
  const repository = new LocalStorageCartRepository({
    getStorage: () => storage,
  });

  await assert.rejects(() =>
    repository.saveCart({
      ...sampleCart,
      items: [
        {
          ...sampleCart.items[0],
          quantity: MAX_QUANTITY_PER_CART_LINE + 1,
        },
      ],
    }),
  );
  assert.equal(storage.values.has(clientStorageKeys.cart), false);
});

test("vaciar el carrito no elimina la sesión provisional", async () => {
  const storage = createStorage({
    [clientStorageKeys.cart]: "carrito",
    [clientStorageKeys.session]: "sesión-conservada",
  });
  const repository = new LocalStorageCartRepository({
    getStorage: () => storage,
  });

  await repository.clearCart();

  assert.equal(storage.values.has(clientStorageKeys.cart), false);
  assert.equal(
    storage.values.get(clientStorageKeys.session),
    "sesión-conservada",
  );
});
