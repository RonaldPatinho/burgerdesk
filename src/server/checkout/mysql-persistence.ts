import {
  attachStripeCheckoutSession,
  createInternalOrder,
  createRetryPaymentAttempt,
  getInternalOrderByCheckoutSessionId,
  getInternalOrderById,
} from "../orders/mysql-order-repository";
import type { CheckoutOrderPersistence } from "./types";

export const mysqlCheckoutOrderPersistence: CheckoutOrderPersistence = {
  createOrder: createInternalOrder,
  getOrderById: getInternalOrderById,
  getOrderByCheckoutSessionId: getInternalOrderByCheckoutSessionId,
  createRetryPaymentAttempt,
  attachCheckoutSession: attachStripeCheckoutSession,
};
