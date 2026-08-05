import type Stripe from "stripe";
import { getStripeServerClient } from "../stripe/client";
import { copToStripeMinorUnits } from "../stripe/money";
import type {
  HostedCheckoutSession,
  StripeCheckoutGateway,
} from "./types";

export class CheckoutConfigurationError extends Error {
  constructor(public readonly setting: "app_url") {
    super("La URL publica de BurgerDesk no esta configurada.");
    this.name = "CheckoutConfigurationError";
  }
}

export function requireCheckoutAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) {
    throw new CheckoutConfigurationError("app_url");
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new CheckoutConfigurationError("app_url");
  }

  const localHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !localHttp) {
    throw new CheckoutConfigurationError("app_url");
  }

  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function mapHostedSession(
  session: Stripe.Checkout.Session,
): HostedCheckoutSession {
  if (
    session.status !== "open" &&
    session.status !== "complete" &&
    session.status !== "expired"
  ) {
    throw new Error("STRIPE_CHECKOUT_STATUS_INVALID");
  }

  return {
    id: session.id,
    url: session.url,
    status: session.status,
    clientReferenceId: session.client_reference_id,
    metadataOrderId: session.metadata?.order_id ?? null,
    metadataPaymentAttemptId: session.metadata?.payment_attempt_id ?? null,
  };
}

export function buildStripeCheckoutSessionParams(input: {
  order: Parameters<StripeCheckoutGateway["createSession"]>[0]["order"];
  attempt: Parameters<StripeCheckoutGateway["createSession"]>[0]["attempt"];
  successUrl: string;
  cancelUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = {
    order_id: input.order.id,
    payment_attempt_id: input.attempt.id,
  };
  const productLines: Stripe.Checkout.SessionCreateParams.LineItem[] =
    input.order.lines.map((line) => {
      const optionNames = line.options.map((option) => option.optionName);
      return {
        quantity: line.quantity,
        price_data: {
          currency: "cop",
          unit_amount: copToStripeMinorUnits(line.unitPriceCop),
          product_data: {
            name: line.productName,
            ...(optionNames.length > 0
              ? { description: optionNames.join(" · ") }
              : {}),
          },
        },
      };
    });
  const serviceLine: Stripe.Checkout.SessionCreateParams.LineItem[] =
    input.order.serviceFeeCop > 0
      ? [
          {
            quantity: 1,
            price_data: {
              currency: "cop",
              unit_amount: copToStripeMinorUnits(input.order.serviceFeeCop),
              product_data: { name: "Servicio BurgerDesk" },
            },
          },
        ]
      : [];

  return {
    mode: "payment",
    locale: "es",
    submit_type: "pay",
    client_reference_id: input.order.id,
    metadata,
    payment_intent_data: { metadata },
    line_items: [...productLines, ...serviceLine],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
}

export function createStripeCheckoutGateway(
  stripe?: Stripe,
): StripeCheckoutGateway {
  const client = () => stripe ?? getStripeServerClient();
  return {
    async createSession(input) {
      const session = await client().checkout.sessions.create(
        buildStripeCheckoutSessionParams(input),
        { idempotencyKey: input.idempotencyKey },
      );
      return mapHostedSession(session);
    },
    async retrieveSession(sessionId) {
      const session = await client().checkout.sessions.retrieve(sessionId);
      return mapHostedSession(session);
    },
  };
}
