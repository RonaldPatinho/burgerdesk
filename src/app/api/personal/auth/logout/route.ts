import { cookies } from "next/headers";
import { revokeStaffSessionByToken } from "@/server/internal-auth/repository";
import {
  INTERNAL_SESSION_COOKIE,
  internalSessionCookieOptions,
} from "@/server/internal-auth/session";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    const cookieStore = await cookies();
    await revokeStaffSessionByToken(
      cookieStore.get(INTERNAL_SESSION_COOKIE)?.value,
    );
    cookieStore.set(INTERNAL_SESSION_COOKIE, "", {
      ...internalSessionCookieOptions(),
      maxAge: 0,
    });

    return Response.json(
      { signedOut: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { message: "No fue posible cerrar la sesión." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
