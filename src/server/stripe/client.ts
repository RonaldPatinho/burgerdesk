import Stripe from "stripe";

const globalStripe = globalThis as typeof globalThis & {
  burgerDeskStripeClient?: Stripe;
};

export class StripeConfigurationError extends Error {
  constructor(public readonly setting: "secret_key" | "webhook_secret") {
    super("La integracion de pago del servidor no esta configurada.");
    this.name = "StripeConfigurationError";
  }
}

function requireStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new StripeConfigurationError("secret_key");
  }
  return secretKey;
}

export function requireStripeWebhookSecret(): string {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new StripeConfigurationError("webhook_secret");
  }
  return webhookSecret;
}

export function getStripeServerClient(): Stripe {
  if (!globalStripe.burgerDeskStripeClient) {
    globalStripe.burgerDeskStripeClient = new Stripe(requireStripeSecretKey(), {
      telemetry: false,
    });
  }
  return globalStripe.burgerDeskStripeClient;
}
