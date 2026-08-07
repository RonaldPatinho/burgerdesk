import { createHash } from "node:crypto";
import {
  MAX_QUANTITY_PER_CART_LINE,
  SERVICE_FEE_COP,
  products as provisionalProducts,
  stores as provisionalStores,
} from "../../data/provisional";
import type {
  Cart,
  CartItem,
  ProductOptionId,
} from "../../domain/models";
import { calculateCartPricing } from "../../domain/pricing";
import type { PersistedOrder } from "../orders/types";
import type {
  CanonicalCheckout,
  CheckoutRequestInput,
} from "./types";

export class CheckoutValidationError extends Error {
  constructor(
    public readonly code:
      | "CART_INVALID"
      | "ORDER_MISMATCH"
      | "ORDER_NOT_OWNED"
      | "ORDER_NOT_RETRYABLE",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function configurationKey(
  productId: string,
  optionIds: readonly ProductOptionId[],
): string {
  return `${productId}::${optionIds.slice().sort().join("+")}`;
}

function normalizeCart(input: CheckoutRequestInput): Cart {
  const itemsByConfiguration = new Map<string, CartItem>();

  for (const item of input.cart.items) {
    const optionIds = item.optionIds.slice().sort();
    const key = configurationKey(item.productId, optionIds);
    const existing = itemsByConfiguration.get(key);
    const quantity = (existing?.quantity ?? 0) + item.quantity;

    if (quantity > MAX_QUANTITY_PER_CART_LINE) {
      throw new CheckoutValidationError(
        "CART_INVALID",
        "Una cantidad supera el maximo permitido.",
      );
    }

    itemsByConfiguration.set(key, {
      id: key,
      productId: item.productId,
      optionIds,
      quantity,
    });
  }

  return {
    items: [...itemsByConfiguration.values()],
    kitchenNote: input.cart.kitchenNote.trim(),
  };
}

export function buildCanonicalCheckout(
  input: CheckoutRequestInput,
): CanonicalCheckout {
  const usesPersistentCatalog = input.catalogSnapshot !== undefined;
  const catalogProducts =
    input.catalogSnapshot?.products ?? provisionalProducts;
  const pickupStore = usesPersistentCatalog
    ? input.catalogSnapshot?.pickupStore ?? null
    : provisionalStores[0] ?? null;

  if (!pickupStore) {
    throw new CheckoutValidationError(
      "CART_INVALID",
      "No existe un local de retiro disponible.",
    );
  }

  const cart = normalizeCart(input);
  let pricing;
  try {
    pricing = calculateCartPricing(
      cart,
      catalogProducts,
      SERVICE_FEE_COP,
      MAX_QUANTITY_PER_CART_LINE,
    );
  } catch {
    throw new CheckoutValidationError(
      "CART_INVALID",
      "El carrito ya no coincide con el catalogo disponible.",
    );
  }

  const lines = pricing.lines.map((pricedLine) => {
    const product = catalogProducts.find(
      (candidate) => candidate.id === pricedLine.productId,
    );
    if (!product) {
      throw new CheckoutValidationError(
        "CART_INVALID",
        "Un producto ya no existe en el catalogo.",
      );
    }
    const options = pricedLine.optionIds.map((optionId) => {
      const option = product.options.find(
        (candidate) => candidate.id === optionId,
      );
      if (!option) {
        throw new CheckoutValidationError(
          "CART_INVALID",
          "Una opcion ya no pertenece al producto.",
        );
      }
      return {
        optionId: option.id,
        optionName: option.name,
        priceCop: option.priceCop,
      };
    });

    return {
      productId: product.id,
      productName: product.name,
      quantity: pricedLine.quantity,
      unitBasePriceCop: product.priceCop,
      unitPriceCop: pricedLine.unitPriceCop,
      lineTotalCop: pricedLine.lineTotalCop,
      options,
    };
  });

  const idempotencyScope = sha256(
    `${input.clientSession.sessionId}:${input.requestId}`,
  );
  const base = {
    creationIdempotencyKey: `checkout-order:${idempotencyScope}`,
    clientSessionId: input.clientSession.sessionId,
    clientId: input.clientSession.clientId,
    userId: input.clientSession.userId ?? null,
    storeId: pickupStore.id,
    kitchenNote: cart.kitchenNote,
    subtotalCop: pricing.subtotalCop,
    serviceFeeCop: pricing.serviceFeeCop,
    totalCop: pricing.totalCop,
    lines,
  } as const;

  return {
    cart,
    draft:
      input.paymentMethod === "stripe"
        ? {
            ...base,
            paymentMethod: "stripe",
            paymentRequestIdempotencyKey: `checkout-attempt:${idempotencyScope}`,
          }
        : { ...base, paymentMethod: "efectivo" },
  };
}

function sameOptions(
  persisted: PersistedOrder["lines"][number]["options"],
  canonical: CanonicalCheckout["draft"]["lines"][number]["options"],
): boolean {
  return (
    persisted.length === canonical.length &&
    persisted.every((option, index) => {
      const expected = canonical[index];
      return (
        expected !== undefined &&
        option.optionId === expected.optionId &&
        option.optionName === expected.optionName &&
        option.priceCop === expected.priceCop
      );
    })
  );
}

export function assertRetryMatchesCanonical(
  order: PersistedOrder,
  canonical: CanonicalCheckout,
  input: CheckoutRequestInput,
): void {
  if (
    order.clientSessionId !== input.clientSession.sessionId ||
    order.clientId !== input.clientSession.clientId
  ) {
    throw new CheckoutValidationError(
      "ORDER_NOT_OWNED",
      "El pedido no pertenece a la sesion actual.",
    );
  }
  if (
    order.paymentMethod !== "stripe" ||
    order.paymentStatus === "pagado" ||
    order.orderStatus === "confirmado"
  ) {
    throw new CheckoutValidationError(
      "ORDER_NOT_RETRYABLE",
      "El pedido no admite otro intento de pago.",
    );
  }

  const draft = canonical.draft;
  const linesMatch =
    order.lines.length === draft.lines.length &&
    order.lines.every((line, index) => {
      const expected = draft.lines[index];
      return (
        expected !== undefined &&
        line.productId === expected.productId &&
        line.productName === expected.productName &&
        line.quantity === expected.quantity &&
        line.unitBasePriceCop === expected.unitBasePriceCop &&
        line.unitPriceCop === expected.unitPriceCop &&
        line.lineTotalCop === expected.lineTotalCop &&
        sameOptions(line.options, expected.options)
      );
    });

  if (
    !linesMatch ||
    order.storeId !== draft.storeId ||
    order.currency !== "COP" ||
    order.kitchenNote !== draft.kitchenNote ||
    order.subtotalCop !== draft.subtotalCop ||
    order.serviceFeeCop !== draft.serviceFeeCop ||
    order.totalCop !== draft.totalCop
  ) {
    throw new CheckoutValidationError(
      "ORDER_MISMATCH",
      "El carrito cambio desde la creacion del pedido.",
    );
  }
}
