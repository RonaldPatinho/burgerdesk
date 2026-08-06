"use client";

import { useRouter } from "next/navigation";
import { CircleAlert, LogOut } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Dialog } from "@/components/ui";
import styles from "./InternalLogoutDialog.module.css";

export interface InternalLogoutDialogProps {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  redirectTo: string;
  accountLabel: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseMessage(value: unknown): string {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : "No fue posible cerrar la sesión.";
}

export function InternalLogoutDialog({
  open,
  onClose,
  endpoint,
  redirectTo,
  accountLabel,
}: InternalLogoutDialogProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  function handleClose() {
    if (pendingRef.current) return;
    setError(null);
    onClose();
  }

  async function handleLogout() {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const value: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseMessage(value));
      }

      router.replace(redirectTo);
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
    <Dialog
      open={open}
      onClose={handleClose}
      title="Cerrar sesión"
      description={`Se cerrará la sesión de ${accountLabel} en este dispositivo.`}
      initialFocusSelector="[data-dialog-initial-focus]"
      actions={
        <>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={pending}
            data-dialog-initial-focus
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            leadingIcon={<LogOut />}
            loading={pending}
            loadingLabel="Cerrando"
            onClick={handleLogout}
          >
            Cerrar sesión
          </Button>
        </>
      }
    >
      <p className={styles.copy}>
        Tendrás que ingresar nuevamente con tus credenciales para volver al
        panel.
      </p>
      {error ? (
        <div className={styles.error} role="alert">
          <CircleAlert aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}
    </Dialog>
  );
}
