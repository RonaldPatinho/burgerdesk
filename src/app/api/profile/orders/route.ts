import { getAuthenticatedClientSession } from "@/server/auth/session";
import { listClientOrders } from "@/server/profile/repository";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await getAuthenticatedClientSession();
  if (!session) {
    return Response.json({ message: "Debes iniciar sesión." }, { status: 401 });
  }
  const orders = await listClientOrders(session.userId);
  return Response.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
