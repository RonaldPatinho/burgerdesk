import type { Cart, ClientSession, Order } from "./models";

export const CLIENT_STORAGE_VERSION = 1 as const;

export const clientStorageKeys = {
  session: "burgerdesk:client:session:v1",
  cart: "burgerdesk:client:cart:v1",
  orders: "burgerdesk:client:orders:v1",
  checkout: "burgerdesk:client:checkout:v1",
} as const;

export interface StoredSessionState {
  version: typeof CLIENT_STORAGE_VERSION;
  session: ClientSession | null;
}

export interface StoredCartState {
  version: typeof CLIENT_STORAGE_VERSION;
  cart: Cart;
  updatedAt: string;
}

export interface StoredOrdersState {
  version: typeof CLIENT_STORAGE_VERSION;
  orders: readonly Order[];
  currentOrderId: string | null;
  updatedAt: string;
}
