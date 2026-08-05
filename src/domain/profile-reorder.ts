import type { ClientOrderDetailView } from "./profile";
import type { CartItem, Product } from "./models";
import { createCartItemId } from "./cart";
import { isProductId, isProductOptionId } from "./validation";

export interface ProfileReorderResult {
  items: readonly CartItem[];
  omittedProductNames: readonly string[];
  omittedOptionNames: readonly string[];
  priceChanged: boolean;
  quantityAdjusted: boolean;
}

export function buildProfileReorder(
  order: ClientOrderDetailView,
  products: readonly Product[],
  maximumQuantity: number,
): ProfileReorderResult {
  const items: CartItem[] = [];
  const omittedProductNames: string[] = [];
  const omittedOptionNames: string[] = [];
  let priceChanged = false;
  let quantityAdjusted = false;

  for (const line of order.lines) {
    if (!isProductId(line.productId)) {
      omittedProductNames.push(line.productName);
      continue;
    }
    const product = products.find((candidate) => candidate.id === line.productId);
    if (!product?.available) {
      omittedProductNames.push(line.productName);
      continue;
    }
    const optionIds = line.options.flatMap((snapshot) => {
      if (!isProductOptionId(snapshot.optionId)) {
        omittedOptionNames.push(snapshot.optionName);
        return [];
      }
      const option = product.options.find(
        (candidate) => candidate.id === snapshot.optionId && candidate.available,
      );
      if (!option) {
        omittedOptionNames.push(snapshot.optionName);
        return [];
      }
      if (option.priceCop !== snapshot.priceCop) priceChanged = true;
      return [option.id];
    });
    if (product.priceCop !== line.unitBasePriceCop) priceChanged = true;
    const quantity = Math.min(Math.max(1, line.quantity), maximumQuantity);
    if (quantity !== line.quantity) quantityAdjusted = true;
    items.push({
      id: createCartItemId(product.id, optionIds),
      productId: product.id,
      optionIds,
      quantity,
    });
  }
  return {
    items,
    omittedProductNames,
    omittedOptionNames,
    priceChanged,
    quantityAdjusted,
  };
}
