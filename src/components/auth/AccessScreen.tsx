"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  Eye,
  EyeOff,
  ReceiptText,
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
import { ClientDesktopSidebar } from "../client/ClientDesktopSidebar";
import { Button, Checkbox, Dialog, Field, SkipLink } from "../ui";
import styles from "./AccessScreen.module.css";

type AccessMode = "signin" | "register";
type PendingAction = AccessMode | "guest" | null;
type PageMessage = {
  tone: "error" | "success";
  title: string;
  description: string;
};

const fieldIds = {
  signin: {
    email: "signin-email",
    password: "signin-password",
  },
  register: {
    fullName: "register-full-name",
    email: "register-email",
    password: "register-password",
  },
} as const;

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
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    setPasswordVisible(false);
    window.requestAnimationFrame(() => {
      if (nextMode === "signin") {
        emailRef.current?.focus();
      } else {
        fullNameRef.current?.focus();
      }
    });
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input: SignInInput = {
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

  return (
    <div className={styles.page}>
      <SkipLink href="#contenido-principal">Saltar al contenido</SkipLink>
      <ClientDesktopSidebar navigationEnabled={false} />

      <div className={styles.content}>
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
            <span className={styles.headerWordmark} aria-hidden="true">
              <span>Burger</span>
              <span>Desk</span>
            </span>
          </div>
        </div>
      </header>

      <main id="contenido-principal" className={styles.main}>
        <div className={styles.desktopTopbar}>
          <div>
            <h1>Acceso de clientes</h1>
            <p>Inicia sesión o crea una cuenta para continuar</p>
          </div>
          <div className={styles.desktopSecurityBadge}>
            <span aria-hidden="true">
              <ShieldCheck />
            </span>
            <p>
              Acceso protegido
              <small>BurgerDesk</small>
            </p>
          </div>
        </div>

        <div className={styles.desktopLayout}>
          <section className={styles.storyPanel} aria-label="Beneficios de tu cuenta BurgerDesk">
            <p className={styles.storyEyebrow}>TU CUENTA BURGERDESK</p>
            <h2>Pide, paga y sigue tu pedido sin filas.</h2>
            <p className={styles.storyCopy}>
              Una experiencia rápida para disfrutar lo importante: tu hamburguesa.
            </p>

            <div className={styles.storyImage}>
              <span>Hecha al momento</span>
              <Image
                src="/images/promotions/combo2.webp"
                alt="Hamburguesa con papas y bebida"
                width={1200}
                height={780}
                sizes="(min-width: 1120px) 28vw, 0px"
              />
            </div>

            <div className={styles.storyFeatures}>
              <article>
                <span aria-hidden="true"><ShoppingBag /></span>
                <div>
                  <h3>Pedidos guardados</h3>
                  <p>Repite tus favoritos fácilmente.</p>
                </div>
              </article>
              <article>
                <span aria-hidden="true"><ReceiptText /></span>
                <div>
                  <h3>Estado en vivo</h3>
                  <p>Consulta cada etapa del pedido.</p>
                </div>
              </article>
              <article>
                <span aria-hidden="true"><ShieldCheck /></span>
                <div>
                  <h3>Pago seguro</h3>
                  <p>Tus datos permanecen protegidos.</p>
                </div>
              </article>
            </div>

            <p className={styles.storyFooter}>BurgerDesk · Tu pedido, a tu ritmo.</p>
          </section>

          <section className={styles.accessPanel} aria-labelledby="client-access-title">
        <div className={styles.heading}>
          <h1 id="client-access-title">Acceso</h1>
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
              ref={emailRef}
              id={fieldIds.signin.email}
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
              id={fieldIds.signin.password}
              name="password"
              type={passwordVisible ? "text" : "password"}
              label="Contraseña"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password}
              leadingIcon={<ShieldCheck />}
              trailingAction={
                <button
                  type="button"
                  aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={passwordVisible}
                  disabled={formDisabled}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              }
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
              className={styles.submitButton}
            >
              Continuar
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              loading={pendingAction === "guest"}
              loadingLabel="Preparando acceso..."
              disabled={formDisabled}
              className={styles.desktopGuestButton}
              onClick={handleGuestAccess}
            >
              Seguir como invitado
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
              id={fieldIds.register.fullName}
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
              id={fieldIds.register.email}
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
              id={fieldIds.register.password}
              name="password"
              type={passwordVisible ? "text" : "password"}
              label="Contraseña"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              error={errors.password}
              leadingIcon={<ShieldCheck />}
              trailingAction={
                <button
                  type="button"
                  aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={passwordVisible}
                  disabled={formDisabled}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              }
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
              className={styles.submitButton}
            >
              Continuar
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              loading={pendingAction === "guest"}
              loadingLabel="Preparando acceso..."
              disabled={formDisabled}
              className={styles.desktopGuestButton}
              onClick={handleGuestAccess}
            >
              Seguir como invitado
            </Button>
          </form>
        )}


        <p className={styles.terms}>
          Al continuar aceptas términos y condiciones.
        </p>

        <div className={styles.desktopSecurityStrip}>
          <ShieldCheck aria-hidden="true" />
          <span>Acceso protegido · Datos editables · Pago seguro</span>
        </div>
          </section>
        </div>
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
    </div>
  );
}
