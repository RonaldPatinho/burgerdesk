import { cookies } from "next/headers";
import { getSessionByToken } from "./repository";

export const CLIENT_SESSION_COOKIE = "burgerdesk_session";
export const CLIENT_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export async function getAuthenticatedClientSession() {
  const cookieStore = await cookies();
  return getSessionByToken(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);
}

export function clientSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CLIENT_SESSION_MAX_AGE_SECONDS,
    priority: "high" as const,
  };
}
