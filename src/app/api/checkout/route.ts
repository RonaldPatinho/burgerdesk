import Stripe from "stripe";
import {
  CheckoutValidationError,
} from "@/server/checkout/canonical-order";
import { mysqlCheckoutOrderPersistence } from "@/server/checkout/mysql-persistence";
import {
  CheckoutRequestError,
  parseCheckoutRequest,
} from "@/server/checkout/request";
import { CheckoutFlowError, createCheckout } from "@/server/checkout/service";
import {
  CheckoutConfigurationError,
  createStripeCheckoutGateway,
  requireCheckoutAppUrl,
} from "@/server/checkout/stripe-checkout";
import { OrderPersistenceError } from "@/server/orders/mysql-order-repository";
import { StripeConfigurationError } from "@/server/stripe/client";
import { getAuthenticatedClientSession } from "@/server/auth/session";
import { getBusinessSettings } from "@/server/business-settings/repository";
import {
  assertCustomerCheckoutAllowed,
  BusinessOperationsError,
} from "@/server/business-settings/policy";
import { catalogService } from "@/services/catalog";

export const runtime = "nodejs";

const MAX_CHECKOUT_BODY_BYTES = 65_536;

function jsonResponse(status: number, message: string): Response {
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_CHECKOUT_BODY_BYTES
  ) {
    throw new CheckoutRequestError(
      "INVALID_BODY",
      "La solicitud de pago supera el tamano permitido.",
    );
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_CHECKOUT_BODY_BYTES) {
    throw new CheckoutRequestError(
      "INVALID_BODY",
      "La solicitud de pago supera el tamano permitido.",
    );
  }
  try {
    return JSON.parse(Buffer.from(body).toString("utf8")) as unknown;
  } catch {
    throw new CheckoutRequestError(
      "INVALID_BODY",
      "La solicitud de pago no contiene JSON valido.",
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const parsedInput = parseCheckoutRequest(await readJsonBody(request));
    const authenticatedSession = await getAuthenticatedClientSession();
    const [catalogProducts, catalogStores, businessSettings] = await Promise.all([
      catalogService.listProducts(),
      catalogService.listStores(),
      getBusinessSettings().catch(() => null),
    ]);
    assertCustomerCheckoutAllowed(businessSettings, parsedInput.paymentMethod);
    const input = {
      ...parsedInput,
      clientSession: authenticatedSession
        ? {
            sessionId: authenticatedSession.sessionId,
            clientId: authenticatedSession.userId,
            userId: authenticatedSession.userId,
          }
        : {
            sessionId: parsedInput.clientSession.sessionId,
            clientId: null,
            userId: null,
          },
      catalogSnapshot: {
        products: catalogProducts,
        pickupStore: catalogStores[0] ?? null,
      },
    };
    const result = await createCheckout(input, {
      persistence: mysqlCheckoutOrderPersistence,
      stripe: createStripeCheckoutGateway(),
      appUrl:
        input.paymentMethod === "stripe" ? requireCheckoutAppUrl() : "",
    });
    return Response.json(result, {
      status: result.reused ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof BusinessOperationsError) {
      return jsonResponse(
        error.code === "SETTINGS_UNAVAILABLE" ? 503 : 409,
        error.message,
      );
    }
    if (
      error instanceof CheckoutRequestError ||
      error instanceof CheckoutValidationError
    ) {
      return jsonResponse(400, error.message);
    }
    if (error instanceof OrderPersistenceError) {
      return jsonResponse(
        error.code === "IDEMPOTENCY_KEY_REUSED" ? 409 : 422,
        error.message,
      );
    }
    if (error instanceof CheckoutFlowError) {
      const conflictCodes = new Set([
        "SESSION_MISMATCH",
        "SESSION_EXPIRED",
      ]);
      return jsonResponse(conflictCodes.has(error.code) ? 409 : 422, error.message);
    }
    if (
      error instanceof StripeConfigurationError ||
      error instanceof CheckoutConfigurationError
    ) {
      return jsonResponse(503, "El pago en linea aun no esta disponible.");
    }
    if (error instanceof Stripe.errors.StripeError) {
      return jsonResponse(
        502,
        "Stripe no pudo preparar el pago. Intenta nuevamente.",
      );
    }
    return jsonResponse(500, "No fue posible preparar el pedido.");
  }
}
