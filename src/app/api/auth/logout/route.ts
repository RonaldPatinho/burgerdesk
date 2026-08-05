import { cookies } from "next/headers";
import { revokeSessionByToken } from "@/server/auth/repository";
import {
  CLIENT_SESSION_COOKIE,
  clientSessionCookieOptions,
} from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();
  await revokeSessionByToken(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);
  cookieStore.set(CLIENT_SESSION_COOKIE, "", {
    ...clientSessionCookieOptions(),
    maxAge: 0,
  });
  return Response.json(
    { signedOut: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
