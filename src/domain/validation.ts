import {
  categoryIds,
  productIds,
  productOptionIds,
  type Cart,
  type CartItem,
  type CategoryId,
  type ClientSession,
  type Order,
  type ProductId,
  type ProductOptionId,
} from "./models";
import {
  CLIENT_STORAGE_VERSION,
  type StoredCartState,
  type StoredOrdersState,
  type StoredSessionState,
} from "./persistence";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: readonly ValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

function includesValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.some((item) => item === value);
}

export function isCategoryId(value: unknown): value is CategoryId {
  return includesValue(categoryIds, value);
}

export function isProductId(value: unknown): value is ProductId {
  return includesValue(productIds, value);
}

export function isProductOptionId(value: unknown): value is ProductOptionId {
  return includesValue(productOptionIds, value);
}

function isCartItem(value: unknown): value is CartItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isProductId(value.productId) &&
    Array.isArray(value.optionIds) &&
    value.optionIds.every(isProductOptionId) &&
    new Set(value.optionIds).size === value.optionIds.length &&
    isPositiveInteger(value.quantity)
  );
}

function isCart(value: unknown): value is Cart {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isCartItem) &&
    typeof value.kitchenNote === "string"
  );
}

function isClientSession(value: unknown): value is ClientSession {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.kind === "guest" &&
    isNonEmptyString(value.sessionId) &&
    isNonEmptyString(value.startedAt)
  ) {
    return true;
  }

  return (
    value.kind === "client" &&
    isNonEmptyString(value.sessionId) &&
    isNonEmptyString(value.clientId) &&
    isNonEmptyString(value.startedAt)
  );
}

const orderStatuses = ["received", "preparing", "ready", "delivered"] as const;
const paymentMethods = ["card", "nequi", "cash"] as const;
const paymentStatuses = ["pending", "validated"] as const;

function isOrderOption(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.optionId === null || isProductOptionId(value.optionId)) &&
    isNonEmptyString(value.name) &&
    isSafeNonNegativeInteger(value.priceCop)
  );
}

function isOrderLine(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    (value.productId === null || isProductId(value.productId)) &&
    isNonEmptyString(value.productName) &&
    isPositiveInteger(value.quantity) &&
    isSafeNonNegativeInteger(value.unitBasePriceCop) &&
    Array.isArray(value.options) &&
    value.options.every(isOrderOption)
  );
}

function isPaymentSummary(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  if (
    !isRecord(value) ||
    !includesValue(paymentMethods, value.method) ||
    !includesValue(paymentStatuses, value.status)
  ) {
    return false;
  }

  if (value.method === "card") {
    return typeof value.lastFour === "string" && /^\d{4}$/.test(value.lastFour);
  }

  if (value.method === "nequi") {
    return isNonEmptyString(value.reference);
  }

  return (
    value.changeForCop === undefined ||
    isSafeNonNegativeInteger(value.changeForCop)
  );
}

function isFulfillment(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  return (
    isRecord(value) &&
    value.kind === "pickup" &&
    isNonEmptyString(value.storeId) &&
    Array.isArray(value.estimateMinutes) &&
    value.estimateMinutes.length === 2 &&
    value.estimateMinutes.every(isPositiveInteger)
  );
}

function isTimelineStep(value: unknown): boolean {
  return (
    isRecord(value) &&
    includesValue(orderStatuses, value.status) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.description) &&
    (value.occurredAt === undefined || typeof value.occurredAt === "string") &&
    (value.displayTime === undefined || typeof value.displayTime === "string")
  );
}

function isOrder(value: unknown): value is Order {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.clientId) &&
    isNullableString(value.createdAt) &&
    includesValue(orderStatuses, value.status) &&
    Array.isArray(value.lines) &&
    value.lines.length > 0 &&
    value.lines.every(isOrderLine) &&
    typeof value.kitchenNote === "string" &&
    isSafeNonNegativeInteger(value.serviceFeeCop) &&
    isPaymentSummary(value.payment) &&
    isFulfillment(value.fulfillment) &&
    Array.isArray(value.timeline) &&
    value.timeline.every(isTimelineStep) &&
    (value.deliveredAt === undefined || typeof value.deliveredAt === "string")
  );
}

function failure(path: string, message: string): ValidationResult<never> {
  return { success: false, issues: [{ path, message }] };
}

export function validateStoredSession(
  value: unknown,
): ValidationResult<StoredSessionState> {
  if (!isRecord(value) || value.version !== CLIENT_STORAGE_VERSION) {
    return failure("version", "La versión de sesión no es compatible.");
  }

  if (value.session !== null && !isClientSession(value.session)) {
    return failure("session", "La sesión guardada no tiene una forma válida.");
  }

  return { success: true, data: value as unknown as StoredSessionState };
}

export function validateStoredCart(
  value: unknown,
): ValidationResult<StoredCartState> {
  if (!isRecord(value) || value.version !== CLIENT_STORAGE_VERSION) {
    return failure("version", "La versión del carrito no es compatible.");
  }

  if (!isCart(value.cart)) {
    return failure("cart", "El carrito guardado no tiene una forma válida.");
  }

  if (!isNonEmptyString(value.updatedAt)) {
    return failure("updatedAt", "El carrito no tiene fecha de actualización.");
  }

  return { success: true, data: value as unknown as StoredCartState };
}

export function validateStoredOrders(
  value: unknown,
): ValidationResult<StoredOrdersState> {
  if (!isRecord(value) || value.version !== CLIENT_STORAGE_VERSION) {
    return failure("version", "La versión de pedidos no es compatible.");
  }

  if (!Array.isArray(value.orders) || !value.orders.every(isOrder)) {
    return failure("orders", "Los pedidos guardados no tienen una forma válida.");
  }

  if (!isNullableString(value.currentOrderId)) {
    return failure("currentOrderId", "El pedido actual no es válido.");
  }

  if (
    value.currentOrderId !== null &&
    !value.orders.some(
      (order) => isRecord(order) && order.id === value.currentOrderId,
    )
  ) {
    return failure(
      "currentOrderId",
      "El pedido actual no existe en los pedidos guardados.",
    );
  }

  if (!isNonEmptyString(value.updatedAt)) {
    return failure("updatedAt", "Los pedidos no tienen fecha de actualización.");
  }

  return { success: true, data: value as unknown as StoredOrdersState };
}
