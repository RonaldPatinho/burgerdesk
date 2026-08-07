"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";

const REFRESH_COOLDOWN_MS = 30_000;

export function AdminDashboardRefresh() {
  const router = useRouter();
  const lastRefreshAt = useRef<number | null>(null);

  useEffect(() => {
    lastRefreshAt.current = Date.now();

    function refreshIfStale() {
      const now = Date.now();
      const previousRefreshAt = lastRefreshAt.current;
      if (
        previousRefreshAt !== null &&
        now - previousRefreshAt < REFRESH_COOLDOWN_MS
      ) {
        return;
      }
      lastRefreshAt.current = now;
      startTransition(() => router.refresh());
    }

    window.addEventListener("focus", refreshIfStale);
    return () => window.removeEventListener("focus", refreshIfStale);
  }, [router]);

  return null;
}
