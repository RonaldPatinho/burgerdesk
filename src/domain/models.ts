export const categoryIds = [
  "combos",
  "clasicas",
  "especiales",
  "burgers",
  "papas",
  "bebidas",
] as const;

export type CategoryId = (typeof categoryIds)[number];

export const productIds = [
  "la-bendita",
  "doble-pecado",
  "santa-pollo",
  "bacon-bendita",
  "papas-cheddar",
  "combo-gloria",
] as const;

export type ProductId = (typeof productIds)[number];

export const productOptionIds = [
  "cheddar-extra",
  "tocineta",
  "cebolla",
  "salsa-incluida",
] as const;

export type ProductOptionId = (typeof productOptionIds)[number];

export type CopAmount = number;
export type IsoDateTime = string;
export type CatalogPlacement = "home" | "menu";

export interface Category {
  id: CategoryId;
  name: string;
  order: number;
  active: boolean;
  placements: readonly CatalogPlacement[];
}

export interface ProductOption {
  id: ProductOptionId;
  name: string;
  priceCop: CopAmount;
  available: boolean;
}

export interface Product {
  id: ProductId;
  name: string;
  summary: string;
  detailDescription?: string;
  priceCop: CopAmount;
  imagePath: `/images/${string}`;
  categoryIds: readonly CategoryId[];
  available: boolean;
  badge?: string;
  options: readonly ProductOption[];
  defaultOptionIds: readonly ProductOptionId[];
}

export interface Promotion {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  imagePath: `/images/${string}`;
  productId: ProductId;
}

export interface StoreLocation {
  id: string;
  name: string;
  pickupEstimateMinutes: readonly [minimum: number, maximum: number];
}

export interface ContactPreferences {
  whatsapp: boolean;
  email: boolean;
}

export interface ClientProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  preferredStoreId: string;
  contactPreferences: ContactPreferences;
  favoriteProductIds: readonly ProductId[];
  reportedOrderCount: number;
}

export interface ClientProfileStats {
  reportedOrderCount: number;
  favoriteCount: number;
  recentOrdersTotalCop: CopAmount;
}

export type ClientSession =
  | {
      kind: "guest";
      sessionId: string;
      startedAt: IsoDateTime;
    }
  | {
      kind: "client";
      sessionId: string;
      clientId: string;
      startedAt: IsoDateTime;
    };

export interface CartItem {
  id: string;
  productId: ProductId;
  optionIds: readonly ProductOptionId[];
  quantity: number;
}

export interface Cart {
  items: readonly CartItem[];
  kitchenNote: string;
}

export interface PricedCartLine {
  itemId: string;
  productId: ProductId;
  productName: string;
  optionIds: readonly ProductOptionId[];
  optionNames: readonly string[];
  quantity: number;
  unitPriceCop: CopAmount;
  lineTotalCop: CopAmount;
}

export interface PricingSummary {
  subtotalCop: CopAmount;
  serviceFeeCop: CopAmount;
  totalCop: CopAmount;
}

export interface PricedCart extends PricingSummary {
  lines: readonly PricedCartLine[];
}

export type PaymentMethod = "stripe" | "cash";
export type PaymentStatus = "pending" | "validated";

export type PaymentSummary =
  | {
      method: "stripe";
      status: PaymentStatus;
    }
  | {
      method: "cash";
      status: PaymentStatus;
      changeForCop?: CopAmount;
    };

export type OrderStatus = "received" | "preparing" | "ready" | "delivered";

export interface OrderOptionSnapshot {
  optionId: ProductOptionId | null;
  name: string;
  priceCop: CopAmount;
}

export interface OrderLine {
  id: string;
  productId: ProductId | null;
  productName: string;
  quantity: number;
  unitBasePriceCop: CopAmount;
  options: readonly OrderOptionSnapshot[];
}

export interface OrderStatusStep {
  status: OrderStatus;
  label: string;
  description: string;
  occurredAt?: IsoDateTime;
  displayTime?: string;
}

export interface PickupFulfillment {
  kind: "pickup";
  storeId: string;
  estimateMinutes: readonly [minimum: number, maximum: number];
}

export interface Order {
  id: string;
  code: string;
  clientId: string;
  createdAt: IsoDateTime | null;
  status: OrderStatus;
  lines: readonly OrderLine[];
  kitchenNote: string;
  serviceFeeCop: CopAmount;
  payment: PaymentSummary | null;
  fulfillment: PickupFulfillment | null;
  timeline: readonly OrderStatusStep[];
  deliveredAt?: IsoDateTime;
}

export interface StripePaymentInput {
  method: "stripe";
  termsAccepted: boolean;
}

export interface CashPaymentInput {
  method: "cash";
  exactAmount: boolean;
  changeForCop?: CopAmount;
}

export type PaymentInput =
  | StripePaymentInput
  | CashPaymentInput;
