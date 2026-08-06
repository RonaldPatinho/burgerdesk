import { cookies } from "next/headers";
import {
  getInternalSessionByToken,
  getStaffSessionByToken,
  INTERNAL_SESSION_LIFETIME_MS,
} from "./repository";

export const INTERNAL_SESSION_COOKIE = "burgerdesk_internal_session";
export const INTERNAL_SESSION_MAX_AGE_SECONDS =
  INTERNAL_SESSION_LIFETIME_MS / 1000;

export async function getAuthenticatedInternalSession() {
  const cookieStore = await cookies();
  return getInternalSessionByToken(
    cookieStore.get(INTERNAL_SESSION_COOKIE)?.value,
  );
}

export async function getAuthenticatedStaffSession() {
  const cookieStore = await cookies();
  return getStaffSessionByToken(
    cookieStore.get(INTERNAL_SESSION_COOKIE)?.value,
  );
}

export function internalSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INTERNAL_SESSION_MAX_AGE_SECONDS,
    priority: "high" as const,
  };
}
