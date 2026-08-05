import { cookies } from "next/headers";
import {
  ClientAuthError,
  registerClient,
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
      typeof value.fullName !== "string" ||
      typeof value.email !== "string" ||
      typeof value.password !== "string"
    ) {
      return Response.json({ message: "Solicitud de registro inválida." }, { status: 400 });
    }
    const result = await registerClient({
      fullName: value.fullName,
      email: value.email,
      password: value.password,
    });
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
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    if (error instanceof ClientAuthError) {
      return Response.json(
        { message: error.message },
        { status: error.code === "EMAIL_ALREADY_EXISTS" ? 409 : 400 },
      );
    }
    return Response.json({ message: "No fue posible crear la cuenta." }, { status: 500 });
  }
}
