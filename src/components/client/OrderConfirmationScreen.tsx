"use client";

import Link from "next/link";
import { Clock3, MapPin, ReceiptText } from "lucide-react";
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
    "order" in value &&
    typeof value.order === "object" &&
    value.order !== null &&
    "id" in value.order &&
    typeof value.order.id === "string"
  );
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
    loadState.kind === "loaded" ? loadState.result.state : loadState.kind;

  useEffect(() => {
    mainRef.current?.focus();
  }, [focusState]);

  const loaded = loadState.kind === "loaded" ? loadState.result : null;
  const pending = loaded?.state === "pending";
  const confirmed = loaded?.state === "confirmed";

  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <main
        ref={mainRef}
        id="contenido-principal"
        className={styles.main}
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

        {confirmed && loaded ? (
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
                <strong>{loaded.order.id}</strong>
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

            <button className={styles.trackingButton} type="button" disabled>
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
      </main>
      <ClientBottomNav active="order" />
    </div>
  );
}
