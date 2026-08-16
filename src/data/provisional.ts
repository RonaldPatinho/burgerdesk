import type {
  Cart,
  Category,
  ClientProfile,
  Order,
  OrderLine,
  Product,
  ProductId,
  ProductOptionId,
  Promotion,
  StoreLocation,
} from "../domain/models";

export const SERVICE_FEE_COP = 2_900;

// El inventario no define existencias ni un máximo. Este límite funcional es
// provisional y vive aquí para poder sustituirlo junto con la fuente de datos.
export const MAX_QUANTITY_PER_CART_LINE = 10;

export const categories = [
  {
    id: "combos",
    name: "Combos",
    order: 1,
    active: true,
    placements: ["home"],
  },
  {
    id: "clasicas",
    name: "Clásicas",
    order: 2,
    active: true,
    placements: ["home"],
  },
  {
    id: "especiales",
    name: "Especiales",
    order: 3,
    active: true,
    placements: ["home"],
  },
  {
    id: "bebidas",
    name: "Bebidas",
    order: 4,
    active: true,
    placements: ["home", "menu"],
  },
  {
    id: "burgers",
    name: "Burgers",
    order: 1,
    active: true,
    placements: ["menu"],
  },
  {
    id: "papas",
    name: "Papas",
    order: 2,
    active: true,
    placements: ["menu"],
  },
] as const satisfies readonly Category[];

export const products = [
  {
    id: "la-bendita",
    name: "La Bendita",
    summary: "Cheddar y salsa",
    detailDescription:
      "Carne de res, cheddar fundido, tocineta, vegetales frescos y salsa secreta BurgerDesk.",
    priceCop: 26_900,
    imagePath: "/images/products/la_bendita.png",
    categoryIds: ["burgers", "clasicas"],
    available: true,
    badge: "Más vendida",
    options: [
      {
        id: "cheddar-extra",
        name: "Cheddar extra",
        priceCop: 3_500,
        available: true,
      },
      {
        id: "tocineta",
        name: "Tocineta",
        priceCop: 4_500,
        available: true,
      },
      {
        id: "cebolla",
        name: "Cebolla",
        priceCop: 2_500,
        available: true,
      },
      {
        id: "salsa-incluida",
        name: "Salsa incluida",
        priceCop: 0,
        available: true,
      },
    ],
    defaultOptionIds: ["cheddar-extra", "salsa-incluida"],
  },
  {
    id: "doble-pecado",
    name: "Doble Pecado",
    summary: "Doble carne",
    priceCop: 34_900,
    imagePath: "/images/products/doble_pecado.png",
    categoryIds: ["burgers", "clasicas"],
    available: true,
    badge: "Doble sabor",
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "santa-pollo",
    name: "Santa Pollo",
    summary: "Pollo crispy",
    priceCop: 28_900,
    imagePath: "/images/products/crispy - copia.webp",
    categoryIds: ["burgers", "especiales"],
    available: true,
    badge: "Nuevo",
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "bacon-bendita",
    name: "Bacon Bendita",
    summary: "Cuádruple tocino",
    priceCop: 34_900,
    imagePath: "/images/products/bacon.png",
    categoryIds: ["burgers", "especiales"],
    available: true,
    badge: "Ahorra 10%",
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "papas-cheddar",
    name: "Papas cheddar",
    summary: "Medianas · salsa aparte",
    priceCop: 12_900,
    imagePath: "/images/products/cheddar.png",
    categoryIds: ["papas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "combo-gloria",
    name: "Combo Gloria",
    summary: "Burger, papas y bebida",
    priceCop: 41_900,
    imagePath: "/images/promotions/combo.png",
    categoryIds: ["combos"],
    available: true,
    badge: "Ahorra 15%",
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "fanta",
    name: "Fanta",
    summary: "Bebida fría",
    priceCop: 6_900,
    imagePath: "/images/products/fanta.png",
    categoryIds: ["bebidas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "sprite",
    name: "Sprite",
    summary: "Bebida fría",
    priceCop: 6_900,
    imagePath: "/images/products/sprite.png",
    categoryIds: ["bebidas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "triple-bacon",
    name: "Triple Bacon",
    summary: "Triple carne, cheddar y tocineta",
    detailDescription:
      "Tres carnes de res, cheddar fundido, tocineta y salsas BurgerDesk.",
    priceCop: 39_900,
    imagePath: "/images/products/triple_bacon.png",
    categoryIds: ["burgers", "especiales"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "doble-crispy-pollo",
    name: "Doble Crispy Pollo",
    summary: "Doble pollo crispy y lechuga",
    detailDescription:
      "Dos filetes de pollo crispy, lechuga fresca y salsa cremosa.",
    priceCop: 34_900,
    imagePath: "/images/products/doble_crispy_pollo.png",
    categoryIds: ["burgers", "especiales"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "doble-crispy-bacon",
    name: "Doble Crispy Bacon",
    summary: "Doble capa crispy, cheddar y tocineta",
    priceCop: 36_900,
    imagePath: "/images/products/doble_crispy_bacon.png",
    categoryIds: ["burgers", "especiales"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "doble-bacon",
    name: "Doble Bacon",
    summary: "Doble carne, cheddar y tocineta",
    priceCop: 36_900,
    imagePath: "/images/products/doble_bacon.png",
    categoryIds: ["burgers", "clasicas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "cheddar-explosiva",
    name: "Cheddar Explosiva",
    summary: "Carne, tocineta y salsa cheddar",
    priceCop: 31_900,
    imagePath: "/images/products/cheddar_explosiva.png",
    categoryIds: ["burgers", "especiales"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "papas-rusticas",
    name: "Papas Rústicas",
    summary: "Corte clásico con piel",
    priceCop: 9_900,
    imagePath: "/images/products/papas_rusticas.webp",
    categoryIds: ["papas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "papas-rejilla",
    name: "Papas Rejilla",
    summary: "Corte rejilla sazonado",
    priceCop: 11_900,
    imagePath: "/images/products/papas_rejilla.webp",
    categoryIds: ["papas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "papas-corte-grueso",
    name: "Papas Corte Grueso",
    summary: "Corte grueso y crujiente",
    priceCop: 10_900,
    imagePath: "/images/products/papas_corte_grueso.webp",
    categoryIds: ["papas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "coca-cola",
    name: "Coca-Cola",
    summary: "Bebida fría",
    priceCop: 6_900,
    imagePath: "/images/products/coca_cola.png",
    categoryIds: ["bebidas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "coca-cola-zero",
    name: "Coca-Cola Zero",
    summary: "Bebida fría sin azúcar",
    priceCop: 6_900,
    imagePath: "/images/products/coca_cola_zero.png",
    categoryIds: ["bebidas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "agua",
    name: "Agua",
    summary: "Agua sin gas",
    priceCop: 4_900,
    imagePath: "/images/products/agua.png",
    categoryIds: ["bebidas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
  {
    id: "jugo-naranja",
    name: "Jugo de Naranja",
    summary: "Jugo de naranja frío",
    priceCop: 7_900,
    imagePath: "/images/products/jugo_naranja.png",
    categoryIds: ["bebidas"],
    available: true,
    options: [],
    defaultOptionIds: [],
  },
] as const satisfies readonly Product[];

export const featuredProductIds = [
  "la-bendita",
  "combo-gloria",
] as const satisfies readonly ProductId[];

export const promotions = [
  {
    id: "bienvenida-combo",
    eyebrow: "BIENVENIDO A BURGERDESK",
    title: "Tu burger favorita, sin esperar en la fila.",
    description: "Ordena y paga desde tu móvil.",
    actionLabel: "Ver menú",
    imagePath: "/images/promotions/combo.png",
    productId: "combo-gloria",
  },
] as const satisfies readonly Promotion[];

export const stores = [
  {
    id: "sede-centro",
    name: "Sede Centro",
    pickupEstimateMinutes: [15, 20],
  },
] as const satisfies readonly StoreLocation[];

export const provisionalClient = {
  id: "client-gabriel-duarte",
  fullName: "Gabriel Duarte",
  email: "gabriel@gmail.com",
  phone: "+57 300 555 0148",
  preferredStoreId: "sede-centro",
  contactPreferences: {
    whatsapp: true,
    email: false,
  },
  favoriteProductIds: [
    "la-bendita",
    "combo-gloria",
    "doble-pecado",
    "santa-pollo",
  ],
  reportedOrderCount: 12,
} as const satisfies ClientProfile;

export const referenceCart = {
  items: [
    {
      id: "la-bendita__cheddar-extra+salsa-incluida",
      productId: "la-bendita",
      optionIds: ["cheddar-extra", "salsa-incluida"],
      quantity: 1,
    },
    {
      id: "papas-cheddar__base",
      productId: "papas-cheddar",
      optionIds: [],
      quantity: 1,
    },
  ],
  kitchenNote: "",
} as const satisfies Cart;

const standardTimeline = [
  {
    status: "received",
    label: "Pedido recibido",
    description: "Pago validado.",
  },
  {
    status: "preparing",
    label: "En preparación",
    description: "La cocina trabaja en tu orden.",
  },
  {
    status: "ready",
    label: "Listo para retirar",
    description: "Recibirás una notificación.",
  },
  {
    status: "delivered",
    label: "Entregado",
    description: "Muestra el código al retirar.",
  },
] as const;

function createCurrentProductOrderLine(
  id: string,
  productId: ProductId,
  quantity: number,
  optionIds: readonly ProductOptionId[] = [],
): OrderLine {
  const product = products.find((candidate) => candidate.id === productId);

  if (!product) {
    throw new Error(`El producto provisional ${productId} no existe.`);
  }

  const options = optionIds.map((optionId) => {
    const option = product.options.find((candidate) => candidate.id === optionId);

    if (!option) {
      throw new Error(
        `El complemento provisional ${optionId} no pertenece a ${productId}.`,
      );
    }

    return {
      optionId: option.id,
      name: option.name,
      priceCop: option.priceCop,
    };
  });

  return {
    id,
    productId: product.id,
    productName: product.name,
    quantity,
    unitBasePriceCop: product.priceCop,
    options,
  };
}

export const orders = [
  {
    id: "order-bd-284",
    code: "BD-284",
    clientId: provisionalClient.id,
    createdAt: null,
    status: "preparing",
    lines: [
      createCurrentProductOrderLine(
        "order-bd-284-la-bendita",
        "la-bendita",
        1,
        ["cheddar-extra", "salsa-incluida"],
      ),
      createCurrentProductOrderLine(
        "order-bd-284-papas-cheddar",
        "papas-cheddar",
        1,
      ),
    ],
    kitchenNote: "",
    serviceFeeCop: SERVICE_FEE_COP,
    payment: {
      method: "stripe",
      status: "validated",
    },
    fulfillment: {
      kind: "pickup",
      storeId: "sede-centro",
      estimateMinutes: [15, 20],
    },
    timeline: standardTimeline.map((step) =>
      step.status === "received"
        ? { ...step, displayTime: "12:42" }
        : step.status === "preparing"
          ? { ...step, displayTime: "En curso" }
          : step,
    ),
  },
  {
    id: "order-bd-271",
    code: "BD-271",
    clientId: provisionalClient.id,
    createdAt: "2026-07-18T19:42:00-05:00",
    status: "delivered",
    lines: [
      createCurrentProductOrderLine(
        "order-bd-271-combo-gloria",
        "combo-gloria",
        1,
      ),
    ],
    kitchenNote: "",
    serviceFeeCop: SERVICE_FEE_COP,
    payment: {
      method: "stripe",
      status: "validated",
    },
    fulfillment: {
      kind: "pickup",
      storeId: "sede-centro",
      estimateMinutes: [15, 20],
    },
    timeline: standardTimeline,
    deliveredAt: "2026-07-18T20:05:00-05:00",
  },
  {
    id: "order-bd-255",
    code: "BD-255",
    clientId: provisionalClient.id,
    createdAt: null,
    status: "delivered",
    lines: [
      createCurrentProductOrderLine(
        "order-bd-255-doble-pecado",
        "doble-pecado",
        1,
      ),
      {
        id: "order-bd-255-malteada",
        productId: null,
        productName: "Malteada",
        quantity: 1,
        unitBasePriceCop: 8_400,
        options: [],
      },
    ],
    kitchenNote: "",
    serviceFeeCop: SERVICE_FEE_COP,
    payment: null,
    fulfillment: null,
    timeline: standardTimeline,
  },
] as const satisfies readonly Order[];

export const provisionalData = {
  categories,
  products,
  featuredProductIds,
  promotions,
  stores,
  client: provisionalClient,
  referenceCart,
  orders,
  policies: {
    serviceFeeCop: SERVICE_FEE_COP,
    maximumQuantityPerCartLine: MAX_QUANTITY_PER_CART_LINE,
  },
} as const;
