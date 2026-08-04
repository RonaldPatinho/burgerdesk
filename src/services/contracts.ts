import type {
  Cart,
  CatalogPlacement,
  Category,
  CategoryId,
  ClientProfile,
  ClientProfileStats,
  ClientSession,
  CopAmount,
  Order,
  PaymentInput,
  Product,
  ProductId,
  Promotion,
  StoreLocation,
} from "../domain/models";

export interface ProductQuery {
  categoryId?: CategoryId;
  search?: string;
  availableOnly?: boolean;
}

export interface CatalogService {
  listCategories(placement?: CatalogPlacement): Promise<readonly Category[]>;
  listProducts(query?: ProductQuery): Promise<readonly Product[]>;
  getProduct(productId: ProductId): Promise<Product | null>;
  listFeaturedProducts(): Promise<readonly Product[]>;
  listPromotions(): Promise<readonly Promotion[]>;
  listStores(): Promise<readonly StoreLocation[]>;
}

export interface SignInInput {
  email: string;
  password: string;
  rememberEmail: boolean;
}

export interface RegistrationInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  termsAccepted: boolean;
}

export interface SessionService {
  getSession(): Promise<ClientSession | null>;
  signIn(input: SignInInput): Promise<ClientSession>;
  register(input: RegistrationInput): Promise<ClientSession>;
  continueAsGuest(): Promise<ClientSession>;
  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface ClientService {
  getProfile(clientId: string): Promise<ClientProfile | null>;
  getProfileStats(clientId: string): Promise<ClientProfileStats | null>;
  saveProfile(profile: ClientProfile): Promise<ClientProfile>;
}

export interface CartRepository {
  getCart(): Promise<Cart>;
  saveCart(cart: Cart): Promise<void>;
  clearCart(): Promise<void>;
}

export interface OrderDraft {
  clientId: string;
  cart: Cart;
  storeId: string;
}

export interface PaymentValidation {
  valid: boolean;
  message: string;
}

export interface CheckoutService {
  validatePayment(
    payment: PaymentInput,
    totalCop: CopAmount,
  ): Promise<PaymentValidation>;
  createOrder(draft: OrderDraft, payment: PaymentInput): Promise<Order>;
}

export interface OrderRepository {
  listByClient(clientId: string): Promise<readonly Order[]>;
  getById(orderId: string): Promise<Order | null>;
  getCurrent(): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
