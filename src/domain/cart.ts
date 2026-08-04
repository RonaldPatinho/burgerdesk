import type {
  Cart,
  CartItem,
  Order,
  Product,
  ProductId,
  ProductOptionId,
} from "./models";
import { assertQuantity } from "./pricing";

export interface QuantityAdjustment {
  itemId: string;
  requestedQuantity: number;
  acceptedQuantity: number;
}

export interface MergeCartResult {
  cart: Cart;
  quantityAdjustments: readonly QuantityAdjustment[];
}

export interface SkippedReorderItem {
  orderLineId: string;
  productName: string;
  reason: "product-missing" | "product-unavailable";
}

export interface OmittedReorderOption {
  orderLineId: string;
  optionName: string;
}

export interface ReorderResult extends MergeCartResult {
  skippedItems: readonly SkippedReorderItem[];
  omittedOptions: readonly OmittedReorderOption[];
}

function normalizedOptionIds(
  optionIds: readonly ProductOptionId[],
): readonly ProductOptionId[] {
  return [...new Set(optionIds)].sort();
}

export function createCartItemId(
  productId: ProductId,
  optionIds: readonly ProductOptionId[],
): string {
  const optionKey = normalizedOptionIds(optionIds).join("+") || "base";
  return `${productId}__${optionKey}`;
}

export function mergeCartItems(
  cart: Cart,
  additions: readonly CartItem[],
  maximumQuantity: number,
): MergeCartResult {
  const merged = new Map<string, CartItem>();
  const quantityAdjustments: QuantityAdjustment[] = [];

  for (const item of [...cart.items, ...additions]) {
    assertQuantity(item.quantity, maximumQuantity);
    const optionIds = normalizedOptionIds(item.optionIds);
    const itemId = createCartItemId(item.productId, optionIds);
    const current = merged.get(itemId);
    const requestedQuantity = (current?.quantity ?? 0) + item.quantity;
    const acceptedQuantity = Math.min(requestedQuantity, maximumQuantity);

    if (acceptedQuantity !== requestedQuantity) {
      quantityAdjustments.push({
        itemId,
        requestedQuantity,
        acceptedQuantity,
      });
    }

    merged.set(itemId, {
      id: itemId,
      productId: item.productId,
      optionIds,
      quantity: acceptedQuantity,
    });
  }

  return {
    cart: {
      items: [...merged.values()],
      kitchenNote: cart.kitchenNote,
    },
    quantityAdjustments,
  };
}

export function buildReorderCart(
  order: Order,
  currentCart: Cart,
  products: readonly Product[],
  maximumQuantity: number,
): ReorderResult {
  const additions: CartItem[] = [];
  const skippedItems: SkippedReorderItem[] = [];
  const omittedOptions: OmittedReorderOption[] = [];

  for (const line of order.lines) {
    if (!line.productId) {
      skippedItems.push({
        orderLineId: line.id,
        productName: line.productName,
        reason: "product-missing",
      });
      continue;
    }

    const product = products.find((candidate) => candidate.id === line.productId);

    if (!product) {
      skippedItems.push({
        orderLineId: line.id,
        productName: line.productName,
        reason: "product-missing",
      });
      continue;
    }

    if (!product.available) {
      skippedItems.push({
        orderLineId: line.id,
        productName: line.productName,
        reason: "product-unavailable",
      });
      continue;
    }

    const optionIds = line.options.flatMap((snapshot) => {
      if (!snapshot.optionId) {
        omittedOptions.push({
          orderLineId: line.id,
          optionName: snapshot.name,
        });
        return [];
      }

      const option = product.options.find(
        (candidate) => candidate.id === snapshot.optionId,
      );

      if (!option?.available) {
        omittedOptions.push({
          orderLineId: line.id,
          optionName: snapshot.name,
        });
        return [];
      }

      return [option.id];
    });

    additions.push({
      id: createCartItemId(product.id, optionIds),
      productId: product.id,
      optionIds,
      quantity: line.quantity,
    });
  }

  const merged = mergeCartItems(currentCart, additions, maximumQuantity);

  return {
    ...merged,
    skippedItems,
    omittedOptions,
  };
}
