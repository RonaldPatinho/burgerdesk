import { cookies } from "next/headers";
import {
  ClientAuthError,
  loginClient,
} from "@/server/auth/repository";
import {
  CLIENT_SESSION_COOKIE,
  clientSessionCookieOptions,
} from "@/server/auth/session";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const value: unknown = await request.json();
    if (
      !isRecord(value) ||
      typeof value.email !== "string" ||
      typeof value.password !== "string"
    ) {
      return Response.json({ message: "Solicitud de acceso inválida." }, { status: 400 });
    }
    const result = await loginClient({ email: value.email, password: value.password });
    const cookieStore = await cookies();
    cookieStore.set(CLIENT_SESSION_COOKIE, result.token, clientSessionCookieOptions());
    return Response.json(
      {
        session: {
          kind: "client",
          sessionId: result.session.sessionId,
          clientId: result.session.userId,
          startedAt: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    if (error instanceof ClientAuthError) {
      return Response.json(
        { message: error.message },
        { status: error.code === "INVALID_CREDENTIALS" ? 401 : 400 },
      );
    }
    return Response.json({ message: "No fue posible iniciar sesión." }, { status: 500 });
  }
}
