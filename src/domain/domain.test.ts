import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_QUANTITY_PER_CART_LINE,
  SERVICE_FEE_COP,
  categories,
  orders,
  products,
  provisionalClient,
  referenceCart,
} from "../data/provisional";
import {
  provisionalCatalogService,
  provisionalClientService,
} from "../services/provisional";
import {
  buildReorderCart,
  mergeCartItems,
  removeCartItem,
  updateCartItemQuantity,
  updateCartKitchenNote,
} from "./cart";
import { formatCop } from "./currency";
import { productIds, type Cart, type Product } from "./models";
import { CLIENT_STORAGE_VERSION } from "./persistence";
import {
  DomainRuleError,
  calculateCartPricing,
  calculateOrderPricing,
  calculateProductUnitPrice,
} from "./pricing";
import {
  validateStoredCart,
  validateStoredOrders,
  validateStoredSession,
} from "./validation";

function getProduct(productId: Product["id"]): Product {
  const product = products.find((candidate) => candidate.id === productId);
  assert.ok(product, `Falta el producto ${productId}.`);
  return product;
}

test("calcula el precio seleccionado de La Bendita desde base y complementos", () => {
  const laBendita = getProduct("la-bendita");

  assert.equal(
    calculateProductUnitPrice(laBendita, laBendita.defaultOptionIds),
    30_400,
  );
});

const expectedStandardBurgerOptions = [
  { id: "cheddar-extra", name: "Cheddar extra", priceCop: 3_500 },
  { id: "tocineta", name: "Tocineta", priceCop: 4_500 },
  { id: "cebolla", name: "Cebolla", priceCop: 2_500 },
  { id: "salsa-incluida", name: "Salsa incluida", priceCop: 0 },
] as const;

test("el catálogo usa identificadores únicos y referencias internas válidas", () => {
  assert.deepEqual(
    products.map((product) => product.id),
    productIds,
  );
  assert.equal(new Set(products.map((product) => product.id)).size, products.length);
  assert.equal(
    new Set(categories.map((category) => category.id)).size,
    categories.length,
  );

  const knownCategoryIds = new Set(categories.map((category) => category.id));

  for (const product of products) {
    assert.ok(
      product.categoryIds.every((categoryId) => knownCategoryIds.has(categoryId)),
      `${product.name} referencia una categoría inexistente.`,
    );

    const availableOptionIds = new Set(product.options.map((option) => option.id));
    assert.ok(
      product.defaultOptionIds.every((optionId) =>
        availableOptionIds.has(optionId),
      ),
      `${product.name} tiene un complemento predeterminado inexistente.`,
    );
  }
});

test("los productos ampliados conservan precios, categorías y recursos canónicos", () => {
  const expectedProducts = [
    ["triple-bacon", 39_900, "burgers", "/images/products/triple_bacon.png"],
    [
      "doble-crispy-pollo",
      34_900,
      "burgers",
      "/images/products/doble_crispy_pollo.png",
    ],
    [
      "doble-crispy-bacon",
      36_900,
      "burgers",
      "/images/products/doble_crispy_bacon.png",
    ],
    ["doble-bacon", 36_900, "burgers", "/images/products/doble_bacon.png"],
    [
      "cheddar-explosiva",
      31_900,
      "burgers",
      "/images/products/cheddar_explosiva.png",
    ],
    ["papas-rusticas", 9_900, "papas", "/images/products/papas_rusticas.webp"],
    ["papas-rejilla", 11_900, "papas", "/images/products/papas_rejilla.webp"],
    [
      "papas-corte-grueso",
      10_900,
      "papas",
      "/images/products/papas_corte_grueso.webp",
    ],
    ["coca-cola", 6_900, "bebidas", "/images/products/coca_cola.png"],
    [
      "coca-cola-zero",
      6_900,
      "bebidas",
      "/images/products/coca_cola_zero.png",
    ],
    ["agua", 4_900, "bebidas", "/images/products/agua.png"],
    ["jugo-naranja", 7_900, "bebidas", "/images/products/jugo_naranja.png"],
  ] as const;

  for (const [id, priceCop, categoryId, imagePath] of expectedProducts) {
    const product = getProduct(id);
    assert.equal(product.priceCop, priceCop);
    assert.ok(product.categoryIds.includes(categoryId));
    assert.equal(product.imagePath, imagePath);
    assert.equal(product.available, true);

    if (categoryId !== "burgers") {
      assert.deepEqual(product.options, []);
      assert.deepEqual(product.defaultOptionIds, []);
    }
  }

  assert.equal(getProduct("fanta").imagePath, "/images/products/fanta.png");
  assert.equal(getProduct("sprite").imagePath, "/images/products/sprite.png");
});

test("todas las burgers disponibles comparten complementos estándar", () => {
  const expectedBurgerIds = [
    "la-bendita",
    "doble-pecado",
    "santa-pollo",
    "bacon-bendita",
    "triple-bacon",
    "doble-crispy-pollo",
    "doble-crispy-bacon",
    "doble-bacon",
    "cheddar-explosiva",
  ];
  const availableBurgers = products.filter(
    (product) =>
      product.available &&
      product.categoryIds.some((categoryId) => categoryId === "burgers"),
  );

  assert.deepEqual(
    availableBurgers.map((product) => product.id),
    expectedBurgerIds,
  );

  for (const burger of availableBurgers) {
    assert.deepEqual(
      burger.options.map(({ id, name, priceCop, available }) => ({
        id,
        name,
        priceCop,
        available,
      })),
      expectedStandardBurgerOptions.map((option) => ({
        ...option,
        available: true,
      })),
    );

    if (burger.id === "la-bendita") {
      assert.deepEqual(burger.defaultOptionIds, [
        "cheddar-extra",
        "salsa-incluida",
      ]);
    } else {
      assert.deepEqual(burger.defaultOptionIds, ["salsa-incluida"]);
      assert.equal(
        calculateProductUnitPrice(burger, burger.defaultOptionIds),
        burger.priceCop,
      );
    }
  }
});

test("papas, bebidas y combos no reciben complementos estándar", () => {
  const productsWithoutBurgerCategory = products.filter(
    (product) =>
      !product.categoryIds.some((categoryId) => categoryId === "burgers"),
  );

  for (const product of productsWithoutBurgerCategory) {
    assert.deepEqual(product.options, []);
    assert.deepEqual(product.defaultOptionIds, []);
  }
});

test("los complementos alteran y revierten el precio de otra burger", () => {
  const doblePecado = getProduct("doble-pecado");

  assert.equal(calculateProductUnitPrice(doblePecado, []), 34_900);
  assert.equal(
    calculateProductUnitPrice(doblePecado, ["cheddar-extra"]),
    38_400,
  );
  assert.equal(calculateProductUnitPrice(doblePecado, ["tocineta"]), 39_400);
  assert.equal(calculateProductUnitPrice(doblePecado, ["cebolla"]), 37_400);
  assert.equal(
    calculateProductUnitPrice(doblePecado, ["salsa-incluida"]),
    doblePecado.priceCop,
  );

  const pricing = calculateCartPricing(
    {
      items: [
        {
          id: "doble-pecado__cheddar-extra+salsa-incluida+tocineta",
          productId: "doble-pecado",
          optionIds: ["cheddar-extra", "tocineta", "salsa-incluida"],
          quantity: 2,
        },
      ],
      kitchenNote: "",
    },
    products,
    0,
    MAX_QUANTITY_PER_CART_LINE,
  );

  assert.equal(pricing.lines[0]?.unitPriceCop, 42_900);
  assert.equal(pricing.lines[0]?.lineTotalCop, 85_800);
  assert.equal(pricing.totalCop, 85_800);
});

test("otra burger conserva configuraciones distintas como líneas separadas", () => {
  const result = mergeCartItems(
    { items: [], kitchenNote: "" },
    [
      {
        id: "temporal-cheddar",
        productId: "triple-bacon",
        optionIds: ["cheddar-extra", "salsa-incluida"],
        quantity: 1,
      },
      {
        id: "temporal-tocineta",
        productId: "triple-bacon",
        optionIds: ["tocineta", "salsa-incluida"],
        quantity: 1,
      },
    ],
    MAX_QUANTITY_PER_CART_LINE,
  );

  assert.deepEqual(
    result.cart.items.map((item) => ({ id: item.id, optionIds: item.optionIds })),
    [
      {
        id: "triple-bacon__cheddar-extra+salsa-incluida",
        optionIds: ["cheddar-extra", "salsa-incluida"],
      },
      {
        id: "triple-bacon__salsa-incluida+tocineta",
        optionIds: ["salsa-incluida", "tocineta"],
      },
    ],
  );
});

test("reconcilia el carrito de referencia con subtotal, servicio y total", () => {
  const pricing = calculateCartPricing(
    referenceCart,
    products,
    SERVICE_FEE_COP,
    MAX_QUANTITY_PER_CART_LINE,
  );

  assert.deepEqual(
    {
      subtotalCop: pricing.subtotalCop,
      serviceFeeCop: pricing.serviceFeeCop,
      totalCop: pricing.totalCop,
    },
    {
      subtotalCop: 43_300,
      serviceFeeCop: 2_900,
      totalCop: 46_200,
    },
  );
});

test("los pedidos provisionales obtienen sus totales desde las líneas", () => {
  const totalsByCode = Object.fromEntries(
    orders.map((order) => [order.code, calculateOrderPricing(order).totalCop]),
  );

  assert.deepEqual(totalsByCode, {
    "BD-284": 46_200,
    "BD-271": 44_800,
    "BD-255": 46_200,
  });
});

test("formatea importes COP con signo de dólar y separador colombiano", () => {
  const formatted = formatCop(26_900);

  assert.equal(formatted, "$26.900");
});

test("rechaza cantidades fuera de la política provisional", () => {
  const invalidCart: Cart = {
    items: [
      {
        id: "la-bendita__base",
        productId: "la-bendita",
        optionIds: [],
        quantity: 0,
      },
    ],
    kitchenNote: "",
  };

  assert.throws(
    () =>
      calculateCartPricing(
        invalidCart,
        products,
        SERVICE_FEE_COP,
        MAX_QUANTITY_PER_CART_LINE,
      ),
    (error: unknown) =>
      error instanceof DomainRuleError && error.code === "INVALID_QUANTITY",
  );
});

test("fusiona líneas iguales sin superar el máximo y reporta el ajuste", () => {
  const currentCart: Cart = {
    items: [
      {
        id: "papas-cheddar__base",
        productId: "papas-cheddar",
        optionIds: [],
        quantity: 8,
      },
    ],
    kitchenNote: "Sin sal",
  };

  const result = mergeCartItems(
    currentCart,
    [
      {
        id: "papas-cheddar__base",
        productId: "papas-cheddar",
        optionIds: [],
        quantity: 3,
      },
    ],
    MAX_QUANTITY_PER_CART_LINE,
  );

  assert.equal(result.cart.items[0]?.quantity, 10);
  assert.equal(result.cart.kitchenNote, "Sin sal");
  assert.deepEqual(result.quantityAdjustments, [
    {
      itemId: "papas-cheddar__base",
      requestedQuantity: 11,
      acceptedQuantity: 10,
    },
  ]);
});

test("el carrito conserva configuraciones diferentes en líneas separadas", () => {
  const result = mergeCartItems(
    { items: [], kitchenNote: "" },
    [
      {
        id: "la-bendita__cheddar-extra",
        productId: "la-bendita",
        optionIds: ["cheddar-extra"],
        quantity: 1,
      },
      {
        id: "la-bendita__tocineta",
        productId: "la-bendita",
        optionIds: ["tocineta"],
        quantity: 1,
      },
    ],
    MAX_QUANTITY_PER_CART_LINE,
  );

  assert.deepEqual(
    result.cart.items.map((item) => item.id),
    ["la-bendita__cheddar-extra", "la-bendita__tocineta"],
  );
});

test("el carrito fusiona selecciones equivalentes aunque cambie su orden", () => {
  const result = mergeCartItems(
    {
      items: [
        {
          id: "configuracion-anterior",
          productId: "la-bendita",
          optionIds: ["tocineta", "cheddar-extra"],
          quantity: 1,
        },
      ],
      kitchenNote: "",
    },
    [
      {
        id: "configuracion-nueva",
        productId: "la-bendita",
        optionIds: ["cheddar-extra", "tocineta"],
        quantity: 2,
      },
    ],
    MAX_QUANTITY_PER_CART_LINE,
  );

  assert.deepEqual(result.cart.items, [
    {
      id: "la-bendita__cheddar-extra+tocineta",
      productId: "la-bendita",
      optionIds: ["cheddar-extra", "tocineta"],
      quantity: 3,
    },
  ]);
});

test("actualiza, elimina y anota el carrito sin alterar las otras líneas", () => {
  const updated = updateCartItemQuantity(
    referenceCart,
    referenceCart.items[0].id,
    2,
    MAX_QUANTITY_PER_CART_LINE,
  );
  const removed = removeCartItem(updated, referenceCart.items[1].id);
  const annotated = updateCartKitchenNote(removed, "Sin sal");
  const updatedPricing = calculateCartPricing(
    updated,
    products,
    SERVICE_FEE_COP,
    MAX_QUANTITY_PER_CART_LINE,
  );

  assert.equal(updated.items[0]?.quantity, 2);
  assert.equal(updated.items[1]?.quantity, 1);
  assert.deepEqual(
    {
      subtotalCop: updatedPricing.subtotalCop,
      totalCop: updatedPricing.totalCop,
    },
    { subtotalCop: 73_700, totalCop: 76_600 },
  );
  assert.deepEqual(
    removed.items.map((item) => item.id),
    [referenceCart.items[0].id],
  );
  assert.equal(annotated.kitchenNote, "Sin sal");
});

test("impide actualizar una línea por debajo de uno o sobre el máximo", () => {
  assert.throws(() =>
    updateCartItemQuantity(
      referenceCart,
      referenceCart.items[0].id,
      0,
      MAX_QUANTITY_PER_CART_LINE,
    ),
  );
  assert.throws(() =>
    updateCartItemQuantity(
      referenceCart,
      referenceCart.items[0].id,
      MAX_QUANTITY_PER_CART_LINE + 1,
      MAX_QUANTITY_PER_CART_LINE,
    ),
  );
});

test("volver a pedir omite el producto histórico que ya no existe", () => {
  const historicalOrder = orders.find((order) => order.code === "BD-255");
  assert.ok(historicalOrder);

  const result = buildReorderCart(
    historicalOrder,
    { items: [], kitchenNote: "" },
    products,
    MAX_QUANTITY_PER_CART_LINE,
  );

  assert.deepEqual(
    result.cart.items.map((item) => item.productId),
    ["doble-pecado"],
  );
  assert.deepEqual(result.skippedItems, [
    {
      orderLineId: "order-bd-255-malteada",
      productName: "Malteada",
      reason: "product-missing",
    },
  ]);
});

test("los esquemas versionados aceptan estados válidos y rechazan versiones ajenas", () => {
  const sessionResult = validateStoredSession({
    version: CLIENT_STORAGE_VERSION,
    session: {
      kind: "client",
      sessionId: "session-demo",
      clientId: provisionalClient.id,
      startedAt: "2026-08-04T12:00:00-04:00",
    },
  });
  const cartResult = validateStoredCart({
    version: CLIENT_STORAGE_VERSION,
    cart: referenceCart,
    updatedAt: "2026-08-04T12:00:00-04:00",
  });
  const ordersResult = validateStoredOrders({
    version: CLIENT_STORAGE_VERSION,
    orders,
    currentOrderId: "order-bd-284",
    updatedAt: "2026-08-04T12:00:00-04:00",
  });

  assert.equal(sessionResult.success, true);
  assert.equal(cartResult.success, true);
  assert.equal(ordersResult.success, true);
  assert.equal(validateStoredCart({ version: 2 }).success, false);
});

test("el servicio provisional filtra catálogo sin exponer el seed a la UI", async () => {
  const menuCategories = await provisionalCatalogService.listCategories("menu");
  const searchResults = await provisionalCatalogService.listProducts({
    search: "pecado",
    availableOnly: true,
  });

  assert.deepEqual(
    menuCategories.map((category) => category.name),
    ["Burgers", "Papas", "Bebidas"],
  );
  assert.deepEqual(
    searchResults.map((product) => product.id),
    ["doble-pecado"],
  );
});

test("las métricas del perfil separan conteos reportados y total reciente calculado", async () => {
  const stats = await provisionalClientService.getProfileStats(
    provisionalClient.id,
  );

  assert.deepEqual(stats, {
    reportedOrderCount: 12,
    favoriteCount: 4,
    recentOrdersTotalCop: 137_200,
  });
});
