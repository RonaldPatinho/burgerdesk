import type { Cart } from "../domain/models";
import { clientStorageKeys } from "../domain/persistence";

export type BrowserCheckoutPaymentMethod = "stripe" | "efectivo";

export interface PendingBrowserCheckout {
  version: 1;
  requestId: string;
  orderId: string | null;
  checkoutSessionId: string | null;
  paymentMethod: BrowserCheckoutPaymentMethod;
  cart: Cart;
  createdAt: string;
}

export interface CheckoutStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BrowserCheckoutOptions {
  getStorage?: () => CheckoutStoragePort;
  createId?: () => string;
  now?: () => string;
}

function getBrowserStorage(): CheckoutStoragePort {
  if (typeof window === "undefined") {
    throw new Error("El estado auxiliar del pago solo existe en el navegador.");
  }
  return window.localStorage;
}

function createBrowserId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCartLike(value: unknown): value is Cart {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    typeof value.kitchenNote === "string" &&
    value.items.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.productId === "string" &&
        Array.isArray(item.optionIds) &&
        item.optionIds.every((optionId) => typeof optionId === "string") &&
        Number.isSafeInteger(item.quantity) &&
        Number(item.quantity) >= 1,
    )
  );
}

function isPendingCheckout(value: unknown): value is PendingBrowserCheckout {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.requestId === "string" &&
    (value.orderId === null || typeof value.orderId === "string") &&
    (value.checkoutSessionId === null ||
      typeof value.checkoutSessionId === "string") &&
    (value.paymentMethod === "stripe" || value.paymentMethod === "efectivo") &&
    isCartLike(value.cart) &&
    typeof value.createdAt === "string"
  );
}

function cartSignature(cart: Cart): string {
  const items = cart.items
    .map((item) => ({
      productId: item.productId,
      optionIds: item.optionIds.slice().sort(),
      quantity: item.quantity,
    }))
    .sort((left, right) =>
      `${left.productId}:${left.optionIds.join("+")}`.localeCompare(
        `${right.productId}:${right.optionIds.join("+")}`,
      ),
    );
  return JSON.stringify({ items, kitchenNote: cart.kitchenNote.trim() });
}

export function cartsHaveEquivalentCheckoutContent(
  left: Cart,
  right: Cart,
): boolean {
  return cartSignature(left) === cartSignature(right);
}

export function shouldClearCartAfterConfirmation(input: {
  cartCanBeCleared: boolean;
  currentCart: Cart;
  submittedCart: Cart | null;
}): boolean {
  return (
    input.cartCanBeCleared &&
    input.submittedCart !== null &&
    cartsHaveEquivalentCheckoutContent(
      input.currentCart,
      input.submittedCart,
    )
  );
}

export class BrowserCheckoutRepository {
  private readonly getStorage: () => CheckoutStoragePort;
  private readonly createId: () => string;
  private readonly now: () => string;

  constructor(options: BrowserCheckoutOptions = {}) {
    this.getStorage = options.getStorage ?? getBrowserStorage;
    this.createId = options.createId ?? createBrowserId;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  getPending(): PendingBrowserCheckout | null {
    const storage = this.getStorage();
    const serialized = storage.getItem(clientStorageKeys.checkout);
    if (!serialized) return null;
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (isPendingCheckout(parsed)) return parsed;
    } catch {
      // Solo se elimina el estado auxiliar invalido del checkout.
    }
    storage.removeItem(clientStorageKeys.checkout);
    return null;
  }

  begin(input: {
    cart: Cart;
    paymentMethod: BrowserCheckoutPaymentMethod;
    forceNewAttempt?: boolean;
  }): { requestId: string; retryOrderId: string | null } {
    const current = this.getPending();
    const sameCheckout =
      current !== null &&
      current.paymentMethod === input.paymentMethod &&
      cartsHaveEquivalentCheckoutContent(current.cart, input.cart);

    if (sameCheckout && !input.forceNewAttempt) {
      return { requestId: current.requestId, retryOrderId: null };
    }

    const next: PendingBrowserCheckout = {
      version: 1,
      requestId: this.createId(),
      orderId: sameCheckout ? current.orderId : null,
      checkoutSessionId: null,
      paymentMethod: input.paymentMethod,
      cart: input.cart,
      createdAt: this.now(),
    };
    this.save(next);
    return {
      requestId: next.requestId,
      retryOrderId:
        input.forceNewAttempt && sameCheckout ? current.orderId : null,
    };
  }

  associate(input: {
    orderId: string;
    checkoutSessionId?: string | null;
  }): PendingBrowserCheckout | null {
    const current = this.getPending();
    if (!current) return null;
    const next = {
      ...current,
      orderId: input.orderId,
      checkoutSessionId: input.checkoutSessionId ?? null,
    };
    this.save(next);
    return next;
  }

  complete(): void {
    this.getStorage().removeItem(clientStorageKeys.checkout);
  }

  private save(value: PendingBrowserCheckout): void {
    this.getStorage().setItem(
      clientStorageKeys.checkout,
      JSON.stringify(value),
    );
  }
}

export const browserCheckoutRepository = new BrowserCheckoutRepository();
