"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import styles from "./StaffLogoutButton.module.css";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function StaffLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  async function handleLogout() {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/personal/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const value: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          isRecord(value) && typeof value.message === "string"
            ? value.message
            : "No fue posible cerrar la sesión.",
        );
      }

      router.replace("/personal/acceso");
      router.refresh();
    } catch (caught: unknown) {
      pendingRef.current = false;
      setPending(false);
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible cerrar la sesión.",
      );
    }
  }

  return (
    <div className={styles.wrapper}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        fullWidth
        loading={pending}
        loadingLabel="Cerrando sesión"
        leadingIcon={<LogOut />}
        onClick={handleLogout}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
