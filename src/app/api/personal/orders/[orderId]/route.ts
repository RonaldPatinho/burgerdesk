import {
  isOperationalOrderStatus,
  type OperationalOrderStatus,
} from "@/domain/staff-orders";
import { getAuthenticatedStaffSession } from "@/server/internal-auth/session";
import {
  getStaffOrderDetail,
  StaffOrderRepositoryError,
  updateStaffOrderOperationalStatus,
} from "@/server/staff-orders/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPDATE_BODY_BYTES = 8_192;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

function validOrderId(orderId: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(orderId);
}

function errorResponse(status: number, message: string): Response {
  return Response.json({ message }, { status, headers: NO_STORE_HEADERS });
}

function parseUpdateBody(value: unknown): {
  expectedStatus: OperationalOrderStatus;
  nextStatus: OperationalOrderStatus;
} | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const expectedStatus = Reflect.get(value, "expectedStatus");
  const nextStatus = Reflect.get(value, "nextStatus");
  if (
    !isOperationalOrderStatus(expectedStatus) ||
    !isOperationalOrderStatus(nextStatus)
  ) {
    return null;
  }

  return { expectedStatus, nextStatus };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const session = await getAuthenticatedStaffSession();
  if (!session) {
    return errorResponse(401, "La sesión del personal no es válida.");
  }

  const { orderId } = await context.params;
  if (!validOrderId(orderId)) {
    return errorResponse(404, "El pedido no existe.");
  }

  try {
    const order = await getStaffOrderDetail(orderId);
    if (!order) return errorResponse(404, "El pedido no existe.");
    return Response.json({ order }, { headers: NO_STORE_HEADERS });
  } catch {
    return errorResponse(500, "No fue posible consultar el pedido.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const session = await getAuthenticatedStaffSession();
  if (!session) {
    return errorResponse(401, "La sesión del personal no es válida.");
  }

  const { orderId } = await context.params;
  if (!validOrderId(orderId)) {
    return errorResponse(404, "El pedido no existe.");
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_UPDATE_BODY_BYTES) {
    return errorResponse(413, "La actualización supera el tamaño permitido.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body).toString("utf8")) as unknown;
  } catch {
    return errorResponse(400, "La actualización no contiene JSON válido.");
  }

  const input = parseUpdateBody(parsed);
  if (!input) {
    return errorResponse(400, "El cambio de estado no es válido.");
  }

  try {
    const order = await updateStaffOrderOperationalStatus({
      orderId,
      expectedStatus: input.expectedStatus,
      nextStatus: input.nextStatus,
      staffUserId: session.userId,
    });
    return Response.json({ order }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof StaffOrderRepositoryError) {
      if (error.code === "ORDER_NOT_FOUND") {
        return errorResponse(404, error.message);
      }
      if (error.code === "STATUS_CONFLICT") {
        return errorResponse(409, error.message);
      }
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "No fue posible actualizar el pedido.");
  }
}
