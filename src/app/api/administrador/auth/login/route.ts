import { cookies } from "next/headers";
import {
  InternalAuthRepositoryError,
  loginAdministrator,
} from "@/server/internal-auth/repository";
import {
  INTERNAL_SESSION_COOKIE,
  internalSessionCookieOptions,
} from "@/server/internal-auth/session";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidAccessRequest(): Response {
  return Response.json(
    { message: "Solicitud de acceso inválida." },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return invalidAccessRequest();
  }

  if (
    !isRecord(value) ||
    typeof value.username !== "string" ||
    typeof value.password !== "string"
  ) {
    return invalidAccessRequest();
  }

  try {
    const result = await loginAdministrator({
      username: value.username,
      password: value.password,
    });
    const cookieStore = await cookies();
    cookieStore.set(
      INTERNAL_SESSION_COOKIE,
      result.token,
      internalSessionCookieOptions(),
    );

    return Response.json(
      {
        session: {
          kind: "administrator",
          sessionId: result.session.sessionId,
          userId: result.session.userId,
          username: result.session.username,
          fullName: result.session.fullName,
          role: result.session.role,
          expiresAt: result.session.expiresAt,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    if (error instanceof InternalAuthRepositoryError) {
      if (
        error.code === "INVALID_CREDENTIALS" ||
        error.code === "NOT_AUTHORIZED"
      ) {
        return Response.json(
          { message: "El usuario o la contraseña no coinciden." },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
      }

      return invalidAccessRequest();
    }

    return Response.json(
      { message: "No fue posible iniciar sesión." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
