import { processStripeWebhookEvent } from "@/server/orders/mysql-order-repository";
import {
  getStripeServerClient,
  requireStripeWebhookSecret,
  StripeConfigurationError,
} from "@/server/stripe/client";
import { mapStripeEvent } from "@/server/stripe/webhook";

export const runtime = "nodejs";

const MAX_WEBHOOK_BODY_BYTES = 1_048_576;

function jsonResponse(status: number, message: string): Response {
  return Response.json({ message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse(400, "Firma de Stripe ausente.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return jsonResponse(413, "El evento supera el tamano permitido.");
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return jsonResponse(413, "El evento supera el tamano permitido.");
  }

  let event;
  try {
    event = getStripeServerClient().webhooks.constructEvent(
      rawBody,
      signature,
      requireStripeWebhookSecret(),
    );
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return jsonResponse(503, "El webhook aun no esta configurado.");
    }
    return jsonResponse(400, "Firma de Stripe no valida.");
  }

  try {
    const result = await processStripeWebhookEvent(mapStripeEvent(event));
    return Response.json({ received: true, duplicate: result.duplicate });
  } catch {
    return jsonResponse(500, "No fue posible procesar el evento.");
  }
}
