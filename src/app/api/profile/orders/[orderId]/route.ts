import { getAuthenticatedClientSession } from "@/server/auth/session";
import {
  ClientProfileRepositoryError,
  getClientOrderDetail,
} from "@/server/profile/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const session = await getAuthenticatedClientSession();
  if (!session) {
    return Response.json({ message: "Debes iniciar sesión." }, { status: 401 });
  }
  const { orderId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return Response.json({ message: "El pedido no existe." }, { status: 404 });
  }
  try {
    const order = await getClientOrderDetail(session.userId, orderId);
    return Response.json({ order }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    if (
      error instanceof ClientProfileRepositoryError &&
      error.code === "ORDER_NOT_FOUND"
    ) {
      return Response.json({ message: error.message }, { status: 404 });
    }
    return Response.json({ message: "No fue posible consultar el pedido." }, { status: 500 });
  }
}
