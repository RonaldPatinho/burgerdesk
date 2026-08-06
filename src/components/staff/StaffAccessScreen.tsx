"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Info,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import {
  validateInternalLogin,
  type InternalAuthFieldErrors,
} from "@/domain/internal-auth";
import { Button, Field } from "@/components/ui";
import styles from "./StaffAccessScreen.module.css";

type AccessMessage = {
  tone: "error" | "success";
  title: string;
  description: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : fallback;
}

export function StaffAccessScreen() {
  const router = useRouter();
  const [errors, setErrors] = useState<InternalAuthFieldErrors>({});
  const [message, setMessage] = useState<AccessMessage | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    const validation = validateInternalLogin({ username, password });

    if (!validation.valid) {
      setErrors(validation.errors);
      setMessage({
        tone: "error",
        title: "Revisa los campos marcados",
        description: "Corrige la información indicada antes de ingresar.",
      });
      window.requestAnimationFrame(() => {
        if (validation.firstInvalidField === "username") {
          usernameRef.current?.focus();
        } else {
          passwordRef.current?.focus();
        }
      });
      return;
    }

    setErrors({});
    setMessage(null);
    pendingRef.current = true;
    setPending(true);

    try {
      const response = await fetch("/api/personal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ username, password }),
      });
      const value: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          responseMessage(
            value,
            "No fue posible iniciar sesión. Inténtalo nuevamente.",
          ),
        );
      }

      setMessage({
        tone: "success",
        title: "Acceso autorizado",
        description: "Abriendo la bandeja del personal.",
      });
      router.replace("/personal/pedidos");
      router.refresh();
    } catch (error: unknown) {
      pendingRef.current = false;
      setPending(false);
      setMessage({
        tone: "error",
        title: "No pudimos iniciar sesión",
        description:
          error instanceof Error
            ? error.message
            : "No fue posible iniciar sesión. Inténtalo nuevamente.",
      });
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand} aria-label="BurgerDesk">
            <span className={styles.logoFrame}>
              <Image
                src="/branding/logo-bd.svg"
                alt=""
                width={48}
                height={48}
                priority
              />
            </span>
            <span className={styles.wordmark} aria-hidden="true">
              <span>Burger</span>
              <span>Desk</span>
            </span>
          </div>
        </div>
      </header>

      <main id="contenido-principal" className={styles.main}>
        <div className={styles.heading}>
          <h1>Acceso personal</h1>
          <p>Ingreso Cocina / Caja</p>
        </div>

        <section className={styles.accessCard} aria-labelledby="staff-access-title">
          <div className={styles.securityIcon} aria-hidden="true">
            <ShieldCheck />
          </div>
          <div className={styles.cardHeading}>
            <h2 id="staff-access-title">Acceso interno</h2>
            <p>Solo personal autorizado.</p>
          </div>

          {message ? (
            <div
              className={styles.message}
              data-tone={message.tone}
              role={message.tone === "error" ? "alert" : "status"}
              aria-live={message.tone === "error" ? "assertive" : "polite"}
            >
              {message.tone === "error" ? (
                <CircleAlert aria-hidden="true" />
              ) : (
                <CircleCheck aria-hidden="true" />
              )}
              <div>
                <h3>{message.title}</h3>
                <p>{message.description}</p>
              </div>
            </div>
          ) : null}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <Field
              ref={usernameRef}
              id="staff-username"
              name="username"
              label="Usuario"
              type="text"
              placeholder="caja01"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pending}
              error={errors.username}
              leadingIcon={<UserRound />}
              className={styles.fieldInput}
            />
            <Field
              ref={passwordRef}
              id="staff-password"
              name="password"
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={pending}
              error={errors.password}
              leadingIcon={<ShieldCheck />}
              className={styles.fieldInput}
            />
            <Button
              type="submit"
              fullWidth
              loading={pending}
              loadingLabel="Ingresando"
              leadingIcon={<ChevronRight />}
              className={styles.submitButton}
            >
              Ingresar
            </Button>
          </form>
        </section>

        <aside className={styles.securityNotice} aria-label="Información de seguridad">
          <Info aria-hidden="true" />
          <p>
            El acceso se registra por seguridad.
            <span>Usa tus credenciales asignadas.</span>
          </p>
        </aside>
      </main>
    </div>
  );
}
