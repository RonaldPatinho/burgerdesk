import type {
  Cart,
  CopAmount,
  Order,
  OrderLine,
  PricedCart,
  PricingSummary,
  Product,
  ProductId,
  ProductOption,
  ProductOptionId,
} from "./models";

export const MIN_ITEM_QUANTITY = 1;

export const domainRuleCodes = [
  "INVALID_AMOUNT",
  "INVALID_QUANTITY",
  "PRODUCT_NOT_FOUND",
  "PRODUCT_UNAVAILABLE",
  "OPTION_NOT_FOUND",
  "OPTION_UNAVAILABLE",
  "DUPLICATE_OPTION",
] as const;

export type DomainRuleCode = (typeof domainRuleCodes)[number];

export class DomainRuleError extends Error {
  constructor(
    public readonly code: DomainRuleCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainRuleError";
  }
}

export function assertCopAmount(amount: CopAmount, fieldName = "importe"): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new DomainRuleError(
      "INVALID_AMOUNT",
      `${fieldName} debe ser un entero COP no negativo.`,
    );
  }
}

export function assertQuantity(quantity: number, maximum: number): void {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < MIN_ITEM_QUANTITY ||
    quantity > maximum
  ) {
    throw new DomainRuleError(
      "INVALID_QUANTITY",
      `La cantidad debe estar entre ${MIN_ITEM_QUANTITY} y ${maximum}.`,
    );
  }
}

function resolveSelectedOptions(
  product: Product,
  optionIds: readonly ProductOptionId[],
): readonly ProductOption[] {
  const uniqueOptionIds = new Set(optionIds);
  if (uniqueOptionIds.size !== optionIds.length) {
    throw new DomainRuleError(
      "DUPLICATE_OPTION",
      "Un complemento no puede seleccionarse más de una vez.",
    );
  }

  return optionIds.map((optionId) => {
    const option = product.options.find((candidate) => candidate.id === optionId);

    if (!option) {
      throw new DomainRuleError(
        "OPTION_NOT_FOUND",
        `El complemento ${optionId} no pertenece a ${product.name}.`,
      );
    }

    if (!option.available) {
      throw new DomainRuleError(
        "OPTION_UNAVAILABLE",
        `El complemento ${option.name} no está disponible.`,
      );
    }

    return option;
  });
}

export function calculateProductUnitPrice(
  product: Product,
  optionIds: readonly ProductOptionId[],
): CopAmount {
  if (!product.available) {
    throw new DomainRuleError(
      "PRODUCT_UNAVAILABLE",
      `${product.name} no está disponible.`,
    );
  }

  assertCopAmount(product.priceCop, `precio de ${product.name}`);
  const options = resolveSelectedOptions(product, optionIds);

  const totalCop = options.reduce((total, option) => {
    assertCopAmount(option.priceCop, `precio de ${option.name}`);
    return total + option.priceCop;
  }, product.priceCop);

  assertCopAmount(totalCop, `precio configurado de ${product.name}`);
  return totalCop;
}

function findProduct(
  products: readonly Product[],
  productId: ProductId,
): Product {
  const product = products.find((candidate) => candidate.id === productId);

  if (!product) {
    throw new DomainRuleError(
      "PRODUCT_NOT_FOUND",
      `No existe el producto ${productId}.`,
    );
  }

  return product;
}

export function calculateCartPricing(
  cart: Cart,
  products: readonly Product[],
  serviceFeeCop: CopAmount,
  maximumQuantity: number,
): PricedCart {
  assertCopAmount(serviceFeeCop, "servicio");

  const lines = cart.items.map((item) => {
    assertQuantity(item.quantity, maximumQuantity);
    const product = findProduct(products, item.productId);
    const selectedOptions = resolveSelectedOptions(product, item.optionIds);
    const unitPriceCop = calculateProductUnitPrice(product, item.optionIds);
    const lineTotalCop = unitPriceCop * item.quantity;
    assertCopAmount(lineTotalCop, `total de ${product.name}`);

    return {
      itemId: item.id,
      productId: product.id,
      productName: product.name,
      optionIds: item.optionIds,
      optionNames: selectedOptions.map((option) => option.name),
      quantity: item.quantity,
      unitPriceCop,
      lineTotalCop,
    };
  });

  const subtotalCop = lines.reduce(
    (total, line) => total + line.lineTotalCop,
    0,
  );
  assertCopAmount(subtotalCop, "subtotal");
  assertCopAmount(subtotalCop + serviceFeeCop, "total");

  return {
    lines,
    subtotalCop,
    serviceFeeCop,
    totalCop: subtotalCop + serviceFeeCop,
  };
}

export function calculateOrderLineTotal(line: OrderLine): CopAmount {
  assertCopAmount(line.unitBasePriceCop, `precio de ${line.productName}`);
  assertQuantity(line.quantity, Number.MAX_SAFE_INTEGER);

  const unitPriceCop = line.options.reduce((total, option) => {
    assertCopAmount(option.priceCop, `precio de ${option.name}`);
    return total + option.priceCop;
  }, line.unitBasePriceCop);

  const lineTotalCop = unitPriceCop * line.quantity;
  assertCopAmount(lineTotalCop, `total de ${line.productName}`);
  return lineTotalCop;
}

export function calculateOrderPricing(order: Order): PricingSummary {
  assertCopAmount(order.serviceFeeCop, "servicio");
  const subtotalCop = order.lines.reduce(
    (total, line) => total + calculateOrderLineTotal(line),
    0,
  );
  assertCopAmount(subtotalCop, "subtotal del pedido");
  assertCopAmount(subtotalCop + order.serviceFeeCop, "total del pedido");

  return {
    subtotalCop,
    serviceFeeCop: order.serviceFeeCop,
    totalCop: subtotalCop + order.serviceFeeCop,
  };
}
