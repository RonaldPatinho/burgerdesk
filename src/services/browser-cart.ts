import { MAX_QUANTITY_PER_CART_LINE } from "../data/provisional";
import type { Cart } from "../domain/models";
import {
  CLIENT_STORAGE_VERSION,
  clientStorageKeys,
  type StoredCartState,
} from "../domain/persistence";
import { assertQuantity } from "../domain/pricing";
import { validateStoredCart } from "../domain/validation";
import type { CartRepository } from "./contracts";

export interface CartStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalStorageCartOptions {
  getStorage?: () => CartStoragePort;
  now?: () => string;
}

function getBrowserStorage(): CartStoragePort {
  if (typeof window === "undefined") {
    throw new Error("El carrito provisional solo está disponible en el navegador.");
  }

  return window.localStorage;
}

function createEmptyCart(): Cart {
  return { items: [], kitchenNote: "" };
}

function hasValidQuantities(cart: Cart): boolean {
  try {
    for (const item of cart.items) {
      assertQuantity(item.quantity, MAX_QUANTITY_PER_CART_LINE);
    }
    return true;
  } catch {
    return false;
  }
}

export class LocalStorageCartRepository implements CartRepository {
  private readonly getStorage: () => CartStoragePort;
  private readonly now: () => string;

  constructor(options: LocalStorageCartOptions = {}) {
    this.getStorage = options.getStorage ?? getBrowserStorage;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async getCart(): Promise<Cart> {
    const storage = this.getStorage();
    const serialized = storage.getItem(clientStorageKeys.cart);

    if (!serialized) {
      return createEmptyCart();
    }

    try {
      const parsed: unknown = JSON.parse(serialized);
      const result = validateStoredCart(parsed);

      if (result.success && hasValidQuantities(result.data.cart)) {
        return result.data.cart;
      }
    } catch {
      // El bloque inferior elimina exclusivamente el carrito inválido.
    }

    storage.removeItem(clientStorageKeys.cart);
    return createEmptyCart();
  }

  async saveCart(cart: Cart): Promise<void> {
    if (!hasValidQuantities(cart)) {
      throw new Error("El carrito contiene una cantidad no válida.");
    }

    const state: StoredCartState = {
      version: CLIENT_STORAGE_VERSION,
      cart,
      updatedAt: this.now(),
    };

    this.getStorage().setItem(clientStorageKeys.cart, JSON.stringify(state));
  }

  async clearCart(): Promise<void> {
    this.getStorage().removeItem(clientStorageKeys.cart);
  }
}

export const browserCartRepository = new LocalStorageCartRepository();
