import {
  isProductId,
  isProductOptionId,
} from "../../domain/validation";
import type { CheckoutRequestInput } from "./types";

const MAX_CHECKOUT_BODY_ITEMS = 50;
const MAX_KITCHEN_NOTE_LENGTH = 500;

export class CheckoutRequestError extends Error {
  constructor(
    public readonly code:
      | "INVALID_BODY"
      | "INVALID_PRODUCT"
      | "UNEXPECTED_FINANCIAL_DATA",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isBoundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minimum &&
    value.length <= maximum
  );
}

function assertNoFinancialFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoFinancialFields);
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLocaleLowerCase("en-US");
    if (
      normalizedKey === "currency" ||
      normalizedKey.includes("price") ||
      normalizedKey.includes("amount") ||
      normalizedKey.includes("total")
    ) {
      throw new CheckoutRequestError(
        "UNEXPECTED_FINANCIAL_DATA",
        "El navegador no puede definir moneda, precios ni totales.",
      );
    }
    assertNoFinancialFields(nestedValue);
  }
}

export function parseCheckoutRequest(value: unknown): CheckoutRequestInput {
  assertNoFinancialFields(value);

  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "requestId",
      "paymentMethod",
      "termsAccepted",
      "clientSession",
      "cart",
      "retryOrderId",
    ]) ||
    !isBoundedString(value.requestId, 16, 96) ||
    (value.paymentMethod !== "stripe" && value.paymentMethod !== "efectivo") ||
    value.termsAccepted !== true ||
    !isRecord(value.clientSession) ||
    !hasOnlyKeys(value.clientSession, ["sessionId", "clientId"]) ||
    !isBoundedString(value.clientSession.sessionId, 1, 191) ||
    !(
      value.clientSession.clientId === null ||
      isBoundedString(value.clientSession.clientId, 1, 191)
    ) ||
    !isRecord(value.cart) ||
    !hasOnlyKeys(value.cart, ["items", "kitchenNote"]) ||
    !Array.isArray(value.cart.items) ||
    value.cart.items.length < 1 ||
    value.cart.items.length > MAX_CHECKOUT_BODY_ITEMS ||
    typeof value.cart.kitchenNote !== "string" ||
    value.cart.kitchenNote.length > MAX_KITCHEN_NOTE_LENGTH ||
    !(
      value.retryOrderId === null ||
      value.retryOrderId === undefined ||
      isBoundedString(value.retryOrderId, 1, 36)
    )
  ) {
    throw new CheckoutRequestError(
      "INVALID_BODY",
      "La solicitud de pago no tiene una forma valida.",
    );
  }

  const items = value.cart.items.map((item) => {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ["productId", "optionIds", "quantity"]) ||
      !isProductId(item.productId) ||
      !Array.isArray(item.optionIds) ||
      !item.optionIds.every(isProductOptionId) ||
      new Set(item.optionIds).size !== item.optionIds.length ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) < 1
    ) {
      throw new CheckoutRequestError(
        isRecord(item) && !isProductId(item.productId)
          ? "INVALID_PRODUCT"
          : "INVALID_BODY",
        "El carrito contiene un producto o una configuracion no valida.",
      );
    }

    return {
      productId: item.productId,
      optionIds: item.optionIds,
      quantity: Number(item.quantity),
    };
  });

  return {
    requestId: value.requestId,
    paymentMethod: value.paymentMethod,
    termsAccepted: true,
    clientSession: {
      sessionId: value.clientSession.sessionId,
      clientId: value.clientSession.clientId,
    },
    cart: {
      items,
      kitchenNote: value.cart.kitchenNote,
    },
    retryOrderId: value.retryOrderId ?? null,
  };
}

export function parseCheckoutStatusRequest(value: unknown): {
  clientSessionId: string;
  orderId: string | null;
  checkoutSessionId: string | null;
} {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "clientSessionId",
      "orderId",
      "checkoutSessionId",
    ]) ||
    !isBoundedString(value.clientSessionId, 1, 191)
  ) {
    throw new CheckoutRequestError(
      "INVALID_BODY",
      "La consulta del pedido no tiene una forma valida.",
    );
  }

  const orderId = value.orderId ?? null;
  const checkoutSessionId = value.checkoutSessionId ?? null;
  if (
    !(orderId === null || isBoundedString(orderId, 1, 36)) ||
    !(
      checkoutSessionId === null ||
      isBoundedString(checkoutSessionId, 1, 255)
    ) ||
    (orderId === null) === (checkoutSessionId === null)
  ) {
    throw new CheckoutRequestError(
      "INVALID_BODY",
      "Debes identificar exactamente un pedido o una sesion de pago.",
    );
  }

  return {
    clientSessionId: value.clientSessionId,
    orderId,
    checkoutSessionId,
  };
}
