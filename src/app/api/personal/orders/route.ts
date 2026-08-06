import { getAuthenticatedStaffSession } from "@/server/internal-auth/session";
import { getStaffOrderInboxSnapshot } from "@/server/staff-orders/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

export async function GET(): Promise<Response> {
  const session = await getAuthenticatedStaffSession();

  if (!session) {
    return Response.json(
      { message: "La sesión del personal no es válida." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const snapshot = await getStaffOrderInboxSnapshot();
    return Response.json({ snapshot }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json(
      { message: "No fue posible actualizar la bandeja de pedidos." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
