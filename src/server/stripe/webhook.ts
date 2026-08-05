import type Stripe from "stripe";
import type {
  StripeWebhookEventData,
  StripeWebhookSessionData,
} from "../orders/types";

const supportedCheckoutEventTypes = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

function getPaymentIntentId(
  paymentIntent: Stripe.Checkout.Session["payment_intent"],
): string | null {
  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }
  return paymentIntent?.id ?? null;
}

function mapCheckoutSession(
  session: Stripe.Checkout.Session,
): StripeWebhookSessionData {
  return {
    id: session.id,
    mode: session.mode,
    paymentStatus: session.payment_status,
    amountTotalMinor: session.amount_total,
    currency: session.currency,
    clientReferenceId: session.client_reference_id,
    metadataOrderId: session.metadata?.order_id ?? null,
    metadataPaymentAttemptId: session.metadata?.payment_attempt_id ?? null,
    paymentIntentId: getPaymentIntentId(session.payment_intent),
  };
}

export function mapStripeEvent(event: Stripe.Event): StripeWebhookEventData {
  const eventCreatedAt = new Date(event.created * 1_000);
  if (Number.isNaN(eventCreatedAt.getTime())) {
    throw new Error("STRIPE_EVENT_DATE_INVALID");
  }

  if (!supportedCheckoutEventTypes.has(event.type)) {
    return {
      eventId: event.id,
      eventType: event.type,
      eventCreatedAt,
      session: null,
    };
  }

  return {
    eventId: event.id,
    eventType: event.type,
    eventCreatedAt,
    session: mapCheckoutSession(event.data.object as Stripe.Checkout.Session),
  };
}
