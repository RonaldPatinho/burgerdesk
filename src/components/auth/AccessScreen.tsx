"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type AuthFieldErrors,
  type AuthFieldName,
  type RegistrationInput,
  type SignInInput,
  validatePasswordReset,
  validateRegistration,
  validateSignIn,
} from "../../domain/auth";
import {
  BrowserSessionError,
  browserSessionService,
} from "../../services/browser-session";
import { Button, Checkbox, Dialog, Field } from "../ui";
import styles from "./AccessScreen.module.css";

type AccessMode = "signin" | "register";
type PendingAction = AccessMode | "guest" | null;
type PageMessage = {
  tone: "error" | "success";
  title: string;
  description: string;
};

const fieldIds: Record<AccessMode, Record<"fullName" | "email" | "password", string>> = {
  signin: {
    fullName: "signin-full-name",
    email: "signin-email",
    password: "signin-password",
  },
  register: {
    fullName: "register-full-name",
    email: "register-email",
    password: "register-password",
  },
};

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function focusField(
  field: AuthFieldName,
  refs: Record<"fullName" | "email" | "password", RefObject<HTMLInputElement | null>>,
): void {
  if (field === "terms") {
    return;
  }

  window.requestAnimationFrame(() => refs[field].current?.focus());
}

export function AccessScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AccessMode>("signin");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [message, setMessage] = useState<PageMessage | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState<string>();
  const [resetSent, setResetSent] = useState(false);
  const pendingRef = useRef(false);
  const navigationTimerRef = useRef<number | null>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fieldRefs = {
    fullName: fullNameRef,
    email: emailRef,
    password: passwordRef,
  };

  useEffect(
    () => () => {
      if (navigationTimerRef.current !== null) {
        window.clearTimeout(navigationTimerRef.current);
      }
    },
    [],
  );

  function beginAction(action: Exclude<PendingAction, null>): boolean {
    if (pendingRef.current) {
      return false;
    }

    pendingRef.current = true;
    setPendingAction(action);
    setMessage(null);
    return true;
  }

  function finishFailedAction(description: string): void {
    pendingRef.current = false;
    setPendingAction(null);
    setMessage({
      tone: "error",
      title: "No pudimos continuar",
      description,
    });
  }

  function finishSuccessfulAction(title: string, description: string): void {
    setMessage({ tone: "success", title, description });
    navigationTimerRef.current = window.setTimeout(() => {
      router.replace("/");
    }, 500);
  }

  function changeMode(nextMode: AccessMode): void {
    if (nextMode === mode || pendingRef.current) {
      return;
    }

    setMode(nextMode);
    setErrors({});
    setMessage(null);
    window.requestAnimationFrame(() => fullNameRef.current?.focus());
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input: SignInInput = {
      fullName: readText(formData, "fullName"),
      email: readText(formData, "email"),
      password: readText(formData, "password"),
      rememberEmail: formData.get("rememberEmail") === "on",
    };
    const validation = validateSignIn(input);

    if (!validation.valid) {
      setErrors(validation.errors);
      setMessage({
        tone: "error",
        title: "Revisa los campos marcados",
        description: "Corrige la información indicada antes de continuar.",
      });
      focusField(validation.firstInvalidField, fieldRefs);
      return;
    }

    setErrors({});
    if (!beginAction("signin")) return;

    try {
      await browserSessionService.signIn(input);
      finishSuccessfulAction(
        "Sesión iniciada",
        "Te llevaremos al inicio de BurgerDesk.",
      );
    } catch (error: unknown) {
      finishFailedAction(
        error instanceof BrowserSessionError
          ? error.message
          : "No fue posible iniciar sesión. Inténtalo nuevamente.",
      );
    }
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input: RegistrationInput = {
      fullName: readText(formData, "fullName"),
      email: readText(formData, "email"),
      password: readText(formData, "password"),
      termsAccepted: true,
    };
    const validation = validateRegistration(input);

    if (!validation.valid) {
      setErrors(validation.errors);
      setMessage({
        tone: "error",
        title: "Revisa los campos marcados",
        description: "Corrige la información indicada antes de continuar.",
      });
      focusField(validation.firstInvalidField, fieldRefs);
      return;
    }

    setErrors({});
    if (!beginAction("register")) return;

    try {
      await browserSessionService.register(input);
      finishSuccessfulAction(
        "Cuenta creada",
        "Tu sesión está lista. Te llevaremos al inicio.",
      );
    } catch (error: unknown) {
      finishFailedAction(
        error instanceof BrowserSessionError
          ? error.message
          : "No fue posible crear la cuenta. Inténtalo nuevamente.",
      );
    }
  }

  async function handleGuestAccess() {
    if (!beginAction("guest")) return;

    try {
      await browserSessionService.continueAsGuest();
      finishSuccessfulAction(
        "Acceso de invitado listo",
        "Te llevaremos al inicio de BurgerDesk.",
      );
    } catch {
      finishFailedAction(
        "El navegador no permitió guardar la sesión de invitado. Revisa sus permisos e inténtalo nuevamente.",
      );
    }
  }

  function openPasswordReset() {
    setResetError(undefined);
    setResetSent(false);
    setResetOpen(true);
  }

  function closePasswordReset() {
    if (!resetPending) {
      setResetOpen(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = readText(formData, "email");
    const validation = validatePasswordReset({ email });

    if (!validation.valid) {
      setResetError(validation.errors.email);
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>("#recovery-email")?.focus(),
      );
      return;
    }

    setResetError(undefined);
    setResetPending(true);

    try {
      await browserSessionService.requestPasswordReset(email);
      setResetSent(true);
    } finally {
      setResetPending(false);
    }
  }

  const formDisabled = pendingAction !== null;
  const activeIds = fieldIds[mode];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBrand}>
            <Image
              src="/branding/logo-bd.svg"
              alt=""
              width={44}
              height={44}
              priority
            />
            <span>BurgerDesk</span>
          </div>
          <div className={styles.headerActions} aria-hidden="true">
            <span className={styles.profileIcon}>
              <UserRound />
            </span>
            <span className={styles.cartIcon}>
              <ShoppingBag />
              <span className={styles.cartCount}>0</span>
            </span>
          </div>
        </div>
      </header>

      <main id="contenido-principal" className={styles.main}>
        <div className={styles.heading}>
          <h1>Acceso</h1>
          <p>Inicia sesión o crea una cuenta</p>
        </div>

        <section className={styles.benefit} aria-label="Ventaja de tu cuenta">
          <div className={styles.benefitBrand}>
            <Image
              src="/branding/logo-bd.svg"
              alt=""
              width={36}
              height={36}
            />
            <span>BurgerDesk</span>
          </div>
          <p>
            Guarda pedidos y consulta tu historial.
            <span>Tu sesión y tus pedidos quedan protegidos.</span>
          </p>
        </section>

        <div className={styles.tabs} role="tablist" aria-label="Tipo de acceso">
          <button
            type="button"
            role="tab"
            id="tab-signin"
            aria-selected={mode === "signin"}
            aria-controls="panel-signin"
            tabIndex={mode === "signin" ? 0 : -1}
            disabled={formDisabled}
            onClick={() => changeMode("signin")}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            id="tab-register"
            aria-selected={mode === "register"}
            aria-controls="panel-register"
            tabIndex={mode === "register" ? 0 : -1}
            disabled={formDisabled}
            onClick={() => changeMode("register")}
          >
            Registrarse
          </button>
        </div>

        <p className={styles.flowHint}>
          Alterna entre acceso y registro según el flujo.
        </p>

        {message ? (
          <section
            className={styles.pageMessage}
            data-tone={message.tone}
            role={message.tone === "error" ? "alert" : "status"}
            aria-live={message.tone === "error" ? "assertive" : "polite"}
          >
            {message.tone === "success" ? (
              <CircleCheck aria-hidden="true" />
            ) : (
              <ShieldCheck aria-hidden="true" />
            )}
            <div>
              <h2>{message.title}</h2>
              <p>{message.description}</p>
            </div>
          </section>
        ) : null}

        {mode === "signin" ? (
          <form
            id="panel-signin"
            className={styles.form}
            role="tabpanel"
            aria-labelledby="tab-signin"
            aria-busy={pendingAction === "signin" || undefined}
            noValidate
            onSubmit={handleSignIn}
          >
            <Field
              ref={fullNameRef}
              id={activeIds.fullName}
              name="fullName"
              label="Nombre completo"
              autoComplete="name"
              error={errors.fullName}
              leadingIcon={<UserRound />}
              disabled={formDisabled}
              maxLength={120}
              size="compact"
              className={styles.fieldInput}
            />
            <Field
              ref={emailRef}
              id={activeIds.email}
              name="email"
              type="email"
              inputMode="email"
              label="Correo electrónico"
              autoComplete="email"
              error={errors.email}
              disabled={formDisabled}
              maxLength={254}
              size="compact"
              className={styles.fieldInput}
            />
            <Field
              ref={passwordRef}
              id={activeIds.password}
              name="password"
              type="password"
              label="Contraseña"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password}
              leadingIcon={<ShieldCheck />}
              disabled={formDisabled}
              maxLength={72}
              size="compact"
              className={styles.fieldInput}
            />

            <div className={styles.rememberRow}>
              <Checkbox
                id="remember-email"
                name="rememberEmail"
                label="Recordarme"
                className={styles.rememberCheckbox}
                defaultChecked
                disabled={formDisabled}
              />
              <button
                type="button"
                className={styles.recoveryButton}
                disabled={formDisabled}
                onClick={openPasswordReset}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={pendingAction === "signin"}
              loadingLabel="Iniciando sesión..."
              disabled={formDisabled}
            >
              Continuar
            </Button>
          </form>
        ) : (
          <form
            id="panel-register"
            className={styles.form}
            role="tabpanel"
            aria-labelledby="tab-register"
            aria-busy={pendingAction === "register" || undefined}
            noValidate
            onSubmit={handleRegistration}
          >
            <Field
              ref={fullNameRef}
              id={activeIds.fullName}
              name="fullName"
              label="Nombre completo"
              autoComplete="name"
              error={errors.fullName}
              leadingIcon={<UserRound />}
              disabled={formDisabled}
              maxLength={120}
              size="compact"
              className={styles.fieldInput}
            />
            <Field
              ref={emailRef}
              id={activeIds.email}
              name="email"
              type="email"
              inputMode="email"
              label="Correo electrónico"
              autoComplete="email"
              error={errors.email}
              disabled={formDisabled}
              maxLength={254}
              size="compact"
              className={styles.fieldInput}
            />
            <Field
              ref={passwordRef}
              id={activeIds.password}
              name="password"
              type="password"
              label="Contraseña"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              error={errors.password}
              leadingIcon={<ShieldCheck />}
              disabled={formDisabled}
              maxLength={72}
              size="compact"
              className={styles.fieldInput}
            />

            <Button
              type="submit"
              fullWidth
              loading={pendingAction === "register"}
              loadingLabel="Creando cuenta..."
              disabled={formDisabled}
            >
              Continuar
            </Button>
          </form>
        )}

        <Button
          variant="secondary"
          fullWidth
          loading={pendingAction === "guest"}
          loadingLabel="Preparando acceso..."
          disabled={formDisabled}
          onClick={handleGuestAccess}
        >
          Seguir como invitado
        </Button>

        <p className={styles.terms}>
          Al continuar aceptas términos y condiciones.
        </p>
      </main>

      <Dialog
        open={resetOpen}
        onClose={closePasswordReset}
        title="Recuperar contraseña"
        description="Esta recuperación es una simulación local. No se enviará ningún correo."
        closeLabel="Cerrar recuperación de contraseña"
        initialFocusSelector="#recovery-email"
      >
        {resetSent ? (
          <div className={styles.resetSuccess} role="status" aria-live="polite">
            <CircleCheck aria-hidden="true" />
            <div>
              <h3>Solicitud simulada</h3>
              <p>Puedes cerrar esta ventana y continuar con el acceso.</p>
            </div>
            <Button fullWidth onClick={closePasswordReset}>
              Volver al acceso
            </Button>
          </div>
        ) : (
          <form className={styles.resetForm} noValidate onSubmit={handlePasswordReset}>
            <Field
              id="recovery-email"
              name="email"
              type="email"
              inputMode="email"
              label="Correo electrónico"
              autoComplete="email"
              error={resetError}
              disabled={resetPending}
              maxLength={254}
              size="compact"
            />
            <div className={styles.resetActions}>
              <Button
                type="button"
                variant="secondary"
                disabled={resetPending}
                onClick={closePasswordReset}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={resetPending}
                loadingLabel="Simulando envío..."
              >
                Continuar
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
