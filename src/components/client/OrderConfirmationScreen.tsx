"use client";

import Link from "next/link";
import {
  Check,
  Clock3,
  Info,
  MapPin,
  ReceiptText,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button, Feedback } from "@/components/ui";
import { formatCop } from "@/domain/currency";
import type { ClientSession, StoreLocation } from "@/domain/models";
import type { CheckoutOrderStatusResult } from "@/server/checkout/types";
import {
  browserCheckoutRepository,
  shouldClearCartAfterConfirmation,
} from "@/services/browser-checkout";
import { browserSessionService } from "@/services/browser-session";
import { ClientBottomNav } from "./ClientBottomNav";
import { useClientCart } from "./ClientCartProvider";
import { ClientHeader } from "./ClientHeader";
import styles from "./OrderConfirmationScreen.module.css";

export interface OrderConfirmationScreenProps {
  checkoutSessionId: string | null;
  orderId: string | null;
  pickupStore: StoreLocation | null;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; result: CheckoutOrderStatusResult }
  | { kind: "error"; message: string };

type ConfirmationView = "confirmation" | "tracking";

const trackingStatuses = [
  "received",
  "preparing",
  "ready",
  "delivered",
] as const;

const trackingStepStates = ["completed", "current", "upcoming"] as const;

function isStringInList<TValue extends string>(
  value: unknown,
  values: readonly TValue[],
): value is TValue {
  return typeof value === "string" && values.some((item) => item === value);
}

function isTrackingResult(
  value: unknown,
): value is NonNullable<CheckoutOrderStatusResult["tracking"]> {
  if (
    typeof value !== "object" ||
    value === null ||
    !("currentStatus" in value) ||
    !isStringInList(value.currentStatus, trackingStatuses) ||
    !("currentLabel" in value) ||
    typeof value.currentLabel !== "string" ||
    !("steps" in value) ||
    !Array.isArray(value.steps)
  ) {
    return false;
  }

  return value.steps.every(
    (step) =>
      typeof step === "object" &&
      step !== null &&
      "status" in step &&
      isStringInList(step.status, trackingStatuses) &&
      "label" in step &&
      typeof step.label === "string" &&
      "description" in step &&
      typeof step.description === "string" &&
      "state" in step &&
      isStringInList(step.state, trackingStepStates) &&
      "occurredAt" in step &&
      (step.occurredAt === null || typeof step.occurredAt === "string"),
  );
}

function isStatusResult(value: unknown): value is CheckoutOrderStatusResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "state" in value &&
    (value.state === "pending" ||
      value.state === "confirmed" ||
      value.state === "expired" ||
      value.state === "failed") &&
    "cartCanBeCleared" in value &&
    typeof value.cartCanBeCleared === "boolean" &&
    "tracking" in value &&
    (value.state === "confirmed"
      ? isTrackingResult(value.tracking)
      : value.tracking === null) &&
    "order" in value &&
    typeof value.order === "object" &&
    value.order !== null &&
    "id" in value.order &&
    typeof value.order.id === "string"
  );
}

function formatOrderTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Hora confirmada";

  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function shortOrderIdentifier(orderId: string): string {
  return orderId.replaceAll("-", "").slice(0, 8).toUpperCase();
}

function responseMessage(value: unknown): string {
  return typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : "No pudimos verificar el pedido.";
}

export function OrderConfirmationScreen({
  checkoutSessionId,
  orderId,
  pickupStore,
}: OrderConfirmationScreenProps) {
  const { cart, status: cartStatus, clearCart } = useClientCart();
  const [session, setSession] = useState<ClientSession | null | undefined>();
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [view, setView] = useState<ConfirmationView>("confirmation");
  const [cartResolution, setCartResolution] = useState<
    "cleared" | "preserved" | "error" | null
  >(null);
  const clearAttemptedRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    void browserSessionService.getSession().then((currentSession) => {
      if (active) setSession(currentSession);
    });
    return () => {
      active = false;
    };
  }, []);

  const verifyOrder = useCallback(async () => {
    if (!session) {
      setLoadState({
        kind: "error",
        message: "No encontramos una sesión local para verificar el pedido.",
      });
      return;
    }
    if (!checkoutSessionId && !orderId) {
      setLoadState({
        kind: "error",
        message: "La dirección de confirmación no identifica ningún pedido.",
      });
      return;
    }

    try {
      const response = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          clientSessionId: session.sessionId,
          orderId,
          checkoutSessionId,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(responseMessage(body));
      if (!isStatusResult(body)) {
        throw new Error("El servidor devolvió un estado de pedido no válido.");
      }
      setLoadState({ kind: "loaded", result: body });
    } catch (error: unknown) {
      setLoadState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos verificar el pedido.",
      });
    }
  }, [checkoutSessionId, orderId, session]);

  useEffect(() => {
    if (session === undefined) return;
    const timer = window.setTimeout(() => void verifyOrder(), 0);
    return () => window.clearTimeout(timer);
  }, [session, verifyOrder]);

  useEffect(() => {
    if (loadState.kind !== "loaded" || loadState.result.state !== "pending") {
      return;
    }
    const timer = window.setTimeout(() => void verifyOrder(), 2_000);
    return () => window.clearTimeout(timer);
  }, [loadState, verifyOrder]);

  useEffect(() => {
    if (
      loadState.kind !== "loaded" ||
      loadState.result.state !== "confirmed" ||
      view !== "tracking"
    ) {
      return;
    }
    const timer = window.setTimeout(() => void verifyOrder(), 15_000);
    return () => window.clearTimeout(timer);
  }, [loadState, verifyOrder, view]);

  useEffect(() => {
    if (
      clearAttemptedRef.current ||
      cartStatus === "loading" ||
      loadState.kind !== "loaded" ||
      !loadState.result.cartCanBeCleared
    ) {
      return;
    }
    clearAttemptedRef.current = true;
    const pending = browserCheckoutRepository.getPending();
    const submittedCart =
      pending?.orderId === loadState.result.order.id ? pending.cart : null;
    const canSafelyClear = shouldClearCartAfterConfirmation({
      cartCanBeCleared: true,
      currentCart: cart,
      submittedCart,
    });

    if (!canSafelyClear) {
      browserCheckoutRepository.complete();
      const timer = window.setTimeout(
        () => setCartResolution("preserved"),
        0,
      );
      return () => window.clearTimeout(timer);
    }

    void clearCart()
      .then(() => {
        browserCheckoutRepository.complete();
        setCartResolution("cleared");
      })
      .catch(() => setCartResolution("error"));
  }, [cart, cartStatus, clearCart, loadState]);

  const focusState =
    loadState.kind === "loaded"
      ? `${loadState.result.state}-${view}`
      : loadState.kind;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    mainRef.current?.focus({ preventScroll: true });
  }, [focusState]);

  const loaded = loadState.kind === "loaded" ? loadState.result : null;
  const pending = loaded?.state === "pending";
  const confirmed = loaded?.state === "confirmed";
  const tracking = confirmed ? loaded?.tracking : null;
  const productCount = loaded
    ? loaded.order.lines.reduce((total, line) => total + line.quantity, 0)
    : 0;

  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <main
        ref={mainRef}
        id="contenido-principal"
        className={styles.main}
        data-view={confirmed ? view : undefined}
        tabIndex={-1}
      >
        {loadState.kind === "loading" || session === undefined ? (
          <Feedback
            variant="loading"
            title="Verificando tu pedido"
            description="Esperamos la confirmación segura del servidor."
          />
        ) : null}

        {loadState.kind === "error" ? (
          <Feedback
            variant="error"
            title="No pudimos verificar el pedido"
            description={loadState.message}
            action={
              <Button fullWidth onClick={() => void verifyOrder()}>
                Intentar de nuevo
              </Button>
            }
          />
        ) : null}

        {pending ? (
          <>
            <Feedback
              variant="loading"
              title="Pago en verificación"
              description="Regresar desde Stripe no confirma el pago. Esperamos la confirmación del webhook."
            />
            <Button fullWidth variant="secondary" onClick={() => void verifyOrder()}>
              Verificar de nuevo
            </Button>
          </>
        ) : null}

        {loaded?.state === "expired" || loaded?.state === "failed" ? (
          <Feedback
            variant="error"
            title={
              loaded.state === "expired"
                ? "La sesión de pago expiró"
                : "El pago no se completo"
            }
            description="No se confirmó el pago y tu carrito permanece guardado."
            action={
              <Link
                className={styles.primaryLink}
                href={`/pago?estado=${loaded.state === "expired" ? "expirado" : "fallido"}`}
              >
                Volver a pago
              </Link>
            }
          />
        ) : null}

        {confirmed && loaded && view === "confirmation" ? (
          <>
            <header className={styles.confirmedHeading}>
              <span className={styles.successIcon} aria-hidden="true">✓</span>
              <h1>¡Pedido confirmado!</h1>
              <p>
                {loaded.order.paymentMethod === "stripe"
                  ? "El servidor confirmó tu pago con Stripe."
                  : "Tu pedido está listo para pagarse al retirar."}
              </p>
            </header>

            <section className={styles.orderCard} aria-labelledby="codigo-pedido">
              <ReceiptText aria-hidden="true" />
              <div>
                <p id="codigo-pedido">Código de pedido</p>
                <strong>
                  <span aria-hidden="true">
                    #{shortOrderIdentifier(loaded.order.id)}
                  </span>
                  <span className={styles.visuallyHidden}>
                    Identificador completo: {loaded.order.id}
                  </span>
                </strong>
              </div>
            </section>

            <section className={styles.details} aria-label="Detalles del pedido">
              <div>
                <Clock3 aria-hidden="true" />
                <span>Tiempo estimado</span>
                <strong>
                  {pickupStore
                    ? `${pickupStore.pickupEstimateMinutes[0]}–${pickupStore.pickupEstimateMinutes[1]} min`
                    : "Por confirmar"}
                </strong>
              </div>
              <div>
                <MapPin aria-hidden="true" />
                <span>Retiro</span>
                <strong>{pickupStore?.name ?? loaded.order.storeId}</strong>
              </div>
            </section>

            <section className={styles.summary} aria-labelledby="resumen-confirmado">
              <h2 id="resumen-confirmado">Resumen del pedido</h2>
              <ul>
                {loaded.order.lines.map((line, index) => (
                  <li key={`${line.productName}-${index}`}>
                    <span>{line.quantity} × {line.productName}</span>
                    <strong>{formatCop(line.lineTotalCop)}</strong>
                  </li>
                ))}
              </ul>
              <dl>
                <div>
                  <dt>Método de pago</dt>
                  <dd>
                    {loaded.order.paymentMethod === "stripe"
                      ? "Pago en línea con Stripe"
                      : "Efectivo"}
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatCop(loaded.order.totalCop)}</dd>
                </div>
              </dl>
            </section>

            {cartResolution === "preserved" ? (
              <p className={styles.notice} role="status">
                El carrito cambió después de iniciar el pago, por eso conservamos
                su contenido actual.
              </p>
            ) : null}
            {cartResolution === "error" ? (
              <p className={styles.errorNotice} role="alert">
                El pedido está confirmado, pero no pudimos vaciar el carrito local.
              </p>
            ) : null}

            <button
              className={styles.trackingButton}
              type="button"
              onClick={() => setView("tracking")}
            >
              Ver estado del pedido
            </button>
            <Link className={styles.secondaryLink} href="/">
              Volver al inicio
            </Link>

            <aside className={styles.thanks}>
              <strong>¡Gracias por elegir BurgerDesk!</strong>
              <span>Te avisaremos cuando tu pedido esté listo.</span>
            </aside>
          </>
        ) : null}

        {confirmed && loaded && tracking && view === "tracking" ? (
          <>
            <header className={styles.trackingHeading}>
              <h1>Estado del pedido</h1>
              <p>Seguimiento actualizado de tu orden.</p>
            </header>

            <section
              className={styles.trackingOrderCard}
              aria-labelledby="pedido-en-seguimiento"
            >
              <p
                id="pedido-en-seguimiento"
                className={styles.trackingOrderIdentity}
                aria-label={`Pedido ${loaded.order.id}`}
              >
                Pedido{" "}
                <strong aria-hidden="true">
                  #{shortOrderIdentifier(loaded.order.id)}
                </strong>
              </p>
              <strong className={styles.trackingTotal}>
                {formatCop(loaded.order.totalCop)}
              </strong>
              <p className={styles.trackingMeta}>
                {productCount} {productCount === 1 ? "producto" : "productos"}
                {" · Retiro en local"}
              </p>
              <p className={styles.statusBadge} role="status">
                <span aria-hidden="true" />
                {tracking.currentLabel}
              </p>
            </section>

            <section className={styles.progress} aria-labelledby="progreso-pedido">
              <h2 id="progreso-pedido">Progreso del pedido</h2>
              <ol className={styles.timeline}>
                {tracking.steps.map((step) => (
                  <li
                    key={step.status}
                    className={styles.timelineStep}
                    data-state={step.state}
                    aria-current={step.state === "current" ? "step" : undefined}
                  >
                    <span className={styles.timelineMarker} aria-hidden="true">
                      {step.state === "upcoming" ? (
                        <Clock3 />
                      ) : (
                        <Check />
                      )}
                    </span>
                    <div>
                      <h3>{step.label}</h3>
                      <p>
                        {step.occurredAt ? (
                          <>
                            <time dateTime={step.occurredAt}>
                              {formatOrderTime(step.occurredAt)}
                            </time>
                            {" · "}
                          </>
                        ) : null}
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <aside className={styles.trackingNotice}>
              <div className={styles.trackingNoticeHeading}>
                <Info aria-hidden="true" />
                <h2>Información</h2>
              </div>
              <p>
                Consulta esta pantalla para verificar el avance. El estado
                siempre aparece con texto e icono.
              </p>
            </aside>

            <div className={styles.trackingActions}>
              <Link className={styles.secondaryLink} href="/menu">
                Volver al menú
              </Link>
              <Link className={styles.primaryLink} href="/menu">
                Nuevo pedido
              </Link>
            </div>
          </>
        ) : null}
      </main>
      <ClientBottomNav active="order" />
    </div>
  );
}
