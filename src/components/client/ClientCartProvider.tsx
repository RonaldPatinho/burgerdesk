"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { MAX_QUANTITY_PER_CART_LINE } from "@/data/provisional";
import { mergeCartItems } from "@/domain/cart";
import type { Cart, CartItem } from "@/domain/models";
import { clientStorageKeys } from "@/domain/persistence";
import { browserCartRepository } from "@/services/browser-cart";

type CartStatus = "loading" | "ready" | "error";

interface CartState {
  cart: Cart;
  status: CartStatus;
}

type CartAction =
  | { type: "loaded"; cart: Cart }
  | { type: "changed"; cart: Cart }
  | { type: "failed"; cart: Cart };

export interface AddCartItemResult {
  acceptedQuantity: number;
  quantityAdjusted: boolean;
}

interface ClientCartValue extends CartState {
  cartCount: number;
  addItem(item: CartItem): Promise<AddCartItemResult>;
  reload(): Promise<void>;
}

const emptyCart: Cart = { items: [], kitchenNote: "" };

const ClientCartContext = createContext<ClientCartValue | null>(null);

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "loaded":
    case "changed":
      return { cart: action.cart, status: "ready" };
    case "failed":
      return { cart: action.cart, status: "error" };
    default:
      return state;
  }
}

function countItems(cart: Cart): number {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}

export interface ClientCartProviderProps {
  children: ReactNode;
}

export function ClientCartProvider({ children }: ClientCartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, {
    cart: emptyCart,
    status: "loading",
  });
  const cartRef = useRef<Cart>(emptyCart);

  const loadCart = useCallback(async () => {
    try {
      const cart = await browserCartRepository.getCart();
      cartRef.current = cart;
      dispatch({ type: "loaded", cart });
    } catch {
      cartRef.current = emptyCart;
      dispatch({ type: "failed", cart: emptyCart });
    }
  }, []);

  useEffect(() => {
    void loadCart();

    function handleStorage(event: StorageEvent) {
      if (event.key === clientStorageKeys.cart) {
        void loadCart();
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadCart]);

  const addItem = useCallback(async (item: CartItem) => {
    const previousCart = cartRef.current;
    const result = mergeCartItems(
      previousCart,
      [item],
      MAX_QUANTITY_PER_CART_LINE,
    );
    const matchingItem = result.cart.items.find(
      (candidate) => candidate.id === item.id,
    );

    cartRef.current = result.cart;
    dispatch({ type: "changed", cart: result.cart });

    try {
      await browserCartRepository.saveCart(result.cart);
    } catch (error: unknown) {
      cartRef.current = previousCart;
      dispatch({ type: "failed", cart: previousCart });
      throw error;
    }

    return {
      acceptedQuantity: matchingItem?.quantity ?? item.quantity,
      quantityAdjusted: result.quantityAdjustments.length > 0,
    };
  }, []);

  const value = useMemo<ClientCartValue>(
    () => ({
      ...state,
      cartCount: countItems(state.cart),
      addItem,
      reload: loadCart,
    }),
    [addItem, loadCart, state],
  );

  return (
    <ClientCartContext.Provider value={value}>
      {children}
    </ClientCartContext.Provider>
  );
}

export function useClientCart(): ClientCartValue {
  const value = useContext(ClientCartContext);

  if (!value) {
    throw new Error("useClientCart debe usarse dentro de ClientCartProvider.");
  }

  return value;
}
