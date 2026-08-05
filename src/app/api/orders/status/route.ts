import {
  CheckoutRequestError,
  parseCheckoutStatusRequest,
} from "@/server/checkout/request";
import { mysqlCheckoutOrderPersistence } from "@/server/checkout/mysql-persistence";
import {
  CheckoutFlowError,
  getCheckoutOrderStatus,
} from "@/server/checkout/service";

export const runtime = "nodejs";

const MAX_STATUS_BODY_BYTES = 8_192;

function jsonResponse(status: number, message: string): Response {
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_STATUS_BODY_BYTES) {
      return jsonResponse(413, "La consulta supera el tamano permitido.");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(body).toString("utf8")) as unknown;
    } catch {
      return jsonResponse(400, "La consulta no contiene JSON valido.");
    }
    const input = parseCheckoutStatusRequest(parsed);
    const result = await getCheckoutOrderStatus(
      input,
      mysqlCheckoutOrderPersistence,
    );
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof CheckoutRequestError) {
      return jsonResponse(400, error.message);
    }
    if (
      error instanceof CheckoutFlowError &&
      error.code === "ORDER_NOT_FOUND"
    ) {
      return jsonResponse(404, error.message);
    }
    return jsonResponse(500, "No pudimos consultar el pedido.");
  }
}
