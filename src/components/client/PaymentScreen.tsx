"use client";

import Link from "next/link";
import {
  Banknote,
  CreditCard,
  ExternalLink,
  LockKeyhole,
  MapPin,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Dialog, Feedback } from "@/components/ui";
import {
  MAX_QUANTITY_PER_CART_LINE,
  SERVICE_FEE_COP,
} from "@/data/provisional";
import { formatCop } from "@/domain/currency";
import type {
  ClientSession,
  Product,
  StoreLocation,
} from "@/domain/models";
import { calculateCartPricing } from "@/domain/pricing";
import type { CheckoutCreationResult } from "@/server/checkout/types";
import {
  browserCheckoutRepository,
  type BrowserCheckoutPaymentMethod,
} from "@/services/browser-checkout";
import { browserSessionService } from "@/services/browser-session";
import { ClientBottomNav } from "./ClientBottomNav";
import { useClientCart } from "./ClientCartProvider";
import { ClientHeader } from "./ClientHeader";
import styles from "./PaymentScreen.module.css";

export interface PaymentScreenProps {
  products: readonly Product[];
  pickupStore: StoreLocation | null;
  returnState: "cancelado" | "expirado" | "fallido" | null;
}

type CashChoice = "exact" | "change" | null;

function isCheckoutCreationResult(value: unknown): value is CheckoutCreationResult {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return false;
  }
  if (value.kind === "cash") {
    return (
      "orderId" in value &&
      typeof value.orderId === "string" &&
      "confirmationPath" in value &&
      typeof value.confirmationPath === "string"
    );
  }
  return (
    value.kind === "stripe" &&
    "orderId" in value &&
    typeof value.orderId === "string" &&
    "checkoutSessionId" in value &&
    typeof value.checkoutSessionId === "string" &&
    "destination" in value &&
    (value.destination === "hosted_checkout" ||
      value.destination === "confirmation") &&
    "redirectUrl" in value &&
    typeof value.redirectUrl === "string"
  );
}

function getErrorMessage(value: unknown): string {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
      ? value.message
      : "No pudimos preparar el pago. Intenta nuevamente."
  );
}

function isHostedStripeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}

export function PaymentScreen({
  products,
  pickupStore,
  returnState,
}: PaymentScreenProps) {
  const { cart, status } = useClientCart();
  const [session, setSession] = useState<ClientSession | null | undefined>();
  const [paymentMethod, setPaymentMethod] =
    useState<BrowserCheckoutPaymentMethod>("stripe");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashChoice, setCashChoice] = useState<CashChoice>(null);
  const [changeFor, setChangeFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  const termsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void browserSessionService.getSession().then((currentSession) => {
      if (active) setSession(currentSession);
    });
    return () => {
      active = false;
    };
  }, []);

  const pricingResult = useMemo(() => {
    if (cart.items.length === 0) return { pricing: null, error: null };
    try {
      return {
        pricing: calculateCartPricing(
          cart,
          products,
          SERVICE_FEE_COP,
          MAX_QUANTITY_PER_CART_LINE,
        ),
        error: null,
      };
    } catch {
      return {
        pricing: null,
        error: "El carrito contiene productos que ya no estan disponibles.",
      };
    }
  }, [cart, products]);

  const forceNewAttempt =
    returnState === "expirado" || returnState === "fallido";

  async function createOrder(method: BrowserCheckoutPaymentMethod) {
    if (submittingRef.current || !pricingResult.pricing || !pickupStore) return;
    if (!termsAccepted) {
      setError("Debes aceptar los términos antes de continuar.");
      termsRef.current?.focus();
      return;
    }
    if (!session) {
      setError("Necesitas iniciar una sesión o continuar como invitado.");
      return;
    }
    if (method === "efectivo") {
      if (!cashChoice) {
      setError("Indica si llevarás el monto exacto o necesitas cambio.");
        return;
      }
      if (
        cashChoice === "change" &&
        (!Number.isSafeInteger(Number(changeFor)) ||
          Number(changeFor) <= pricingResult.pricing.totalCop)
      ) {
        setError("Indica un monto entero mayor que el total del pedido.");
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    const pending = browserCheckoutRepository.begin({
      cart,
      paymentMethod: method,
      forceNewAttempt: method === "stripe" && forceNewAttempt,
    });

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: pending.requestId,
          paymentMethod: method,
          termsAccepted: true,
          clientSession: {
            sessionId: session.sessionId,
            clientId: session.kind === "client" ? session.clientId : null,
          },
          cart: {
            items: cart.items.map((item) => ({
              productId: item.productId,
              optionIds: item.optionIds,
              quantity: item.quantity,
            })),
            kitchenNote: cart.kitchenNote,
          },
          retryOrderId: pending.retryOrderId,
        }),
      });
      const responseBody: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(responseBody));
      if (!isCheckoutCreationResult(responseBody)) {
        throw new Error("El servidor devolvió una respuesta de pago no válida.");
      }

      browserCheckoutRepository.associate({
        orderId: responseBody.orderId,
        checkoutSessionId:
          responseBody.kind === "stripe"
            ? responseBody.checkoutSessionId
            : null,
      });

      if (responseBody.kind === "cash") {
        if (!responseBody.confirmationPath.startsWith("/pedido/confirmacion?")) {
          throw new Error("La confirmación del pedido no es válida.");
        }
        window.location.assign(responseBody.confirmationPath);
        return;
      }

      if (responseBody.destination === "hosted_checkout") {
        if (!isHostedStripeUrl(responseBody.redirectUrl)) {
          throw new Error("Stripe no devolvió una dirección de pago segura.");
        }
      } else if (!responseBody.redirectUrl.startsWith("/pedido/confirmacion?")) {
        throw new Error("La verificación del pedido no es válida.");
      }
      window.location.assign(responseBody.redirectUrl);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No pudimos preparar el pago. Intenta nuevamente.",
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handlePrimaryAction() {
    if (paymentMethod === "efectivo") {
      setError("");
      setCashDialogOpen(true);
      return;
    }
    void createOrder("stripe");
  }

  const returnFeedback =
    returnState === "cancelado"
      ? {
          title: "Pago cancelado",
          description:
            "No se confirmó ningún pago. Tu carrito permanece intacto y puedes intentarlo nuevamente.",
        }
      : returnState === "expirado"
        ? {
            title: "La sesión de pago expiró",
            description:
              "Tu carrito se conservó. Iniciaremos un nuevo intento sobre el mismo pedido.",
          }
        : returnState === "fallido"
          ? {
              title: "El pago no se completo",
              description:
              "Tu carrito se conservó. Puedes crear un nuevo intento de pago.",
            }
          : null;

  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <main id="contenido-principal" className={styles.main}>
        <header className={styles.heading}>
          <p>Finaliza tu pedido</p>
          <h1>Pago seguro</h1>
          <span>Elige cómo quieres pagar</span>
        </header>

        {returnFeedback ? (
          <Feedback
            variant="warning"
            title={returnFeedback.title}
            description={returnFeedback.description}
          />
        ) : null}

        {status === "loading" || session === undefined ? (
          <Feedback
            variant="loading"
            title="Preparando el pago"
            description="Estamos recuperando tu carrito y tu sesión."
          />
        ) : null}

        {status !== "loading" && cart.items.length === 0 ? (
          <Feedback
            variant="empty"
            title="No hay productos para pagar"
            description="Agrega productos desde el menú antes de continuar."
            action={
              <Link className={styles.feedbackLink} href="/menu">
                Ver menú
              </Link>
            }
          />
        ) : null}

        {status !== "loading" && cart.items.length > 0 ? (
          <>
            <fieldset className={styles.methods} disabled={submitting}>
              <legend>Método de pago</legend>
              <label className={styles.method} data-selected={paymentMethod === "stripe"}>
                <input
                  type="radio"
                  name="payment-method"
                  value="stripe"
                  checked={paymentMethod === "stripe"}
                  onChange={() => setPaymentMethod("stripe")}
                />
                <span className={styles.methodIcon}>
                  <CreditCard aria-hidden="true" />
                </span>
                <span>
                  <strong>Pago en línea</strong>
                  <small>Checkout alojado por Stripe</small>
                </span>
              </label>
              <label className={styles.method} data-selected={paymentMethod === "efectivo"}>
                <input
                  type="radio"
                  name="payment-method"
                  value="efectivo"
                  checked={paymentMethod === "efectivo"}
                  onChange={() => setPaymentMethod("efectivo")}
                />
                <span className={styles.methodIcon}>
                  <Banknote aria-hidden="true" />
                </span>
                <span>
                  <strong>Efectivo</strong>
                  <small>Paga al retirar en el local</small>
                </span>
              </label>
            </fieldset>

            {paymentMethod === "stripe" ? (
              <section className={styles.stripeNotice} aria-label="Seguridad de Stripe">
                <LockKeyhole aria-hidden="true" />
                <p>
                  Serás redirigido al Checkout seguro de Stripe. BurgerDesk no
                  recibe ni almacena los datos de tu tarjeta.
                </p>
                <ExternalLink aria-hidden="true" />
              </section>
            ) : null}

            {pricingResult.error ? (
              <Feedback
                variant="error"
                title="No pudimos calcular el pedido"
                description={pricingResult.error}
              />
            ) : null}

            {pricingResult.pricing ? (
              <section className={styles.summary} aria-labelledby="resumen-pago">
                <div className={styles.summaryHeader}>
                  <div>
                    <p>Tu pedido</p>
                    <h2 id="resumen-pago">Resumen</h2>
                  </div>
                  <span>{cart.items.reduce((total, item) => total + item.quantity, 0)} items</span>
                </div>
                <ul>
                  {pricingResult.pricing.lines.map((line) => (
                    <li key={line.itemId}>
                      <span>{line.quantity} × {line.productName}</span>
                      <strong>{formatCop(line.lineTotalCop)}</strong>
                    </li>
                  ))}
                </ul>
                <dl>
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{formatCop(pricingResult.pricing.subtotalCop)}</dd>
                  </div>
                  <div>
                    <dt>Servicio</dt>
                    <dd>{formatCop(pricingResult.pricing.serviceFeeCop)}</dd>
                  </div>
                  <div className={styles.totalRow}>
                    <dt>Total</dt>
                    <dd>{formatCop(pricingResult.pricing.totalCop)}</dd>
                  </div>
                </dl>
                <p className={styles.pickup}>
                  <MapPin aria-hidden="true" />
                  {pickupStore
                    ? `Retiro en ${pickupStore.name} · ${pickupStore.pickupEstimateMinutes[0]}–${pickupStore.pickupEstimateMinutes[1]} min`
                    : "No hay un local de retiro disponible"}
                </p>
              </section>
            ) : null}

            <Checkbox
              ref={termsRef}
              id="payment-terms"
              label="Acepto los términos del pedido y la política de pagos"
              checked={termsAccepted}
              disabled={submitting}
              aria-describedby={error ? "payment-error" : undefined}
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                setError("");
              }}
            />

            {error ? (
              <p id="payment-error" className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <Button
              fullWidth
              loading={submitting}
              loadingLabel="Preparando pedido"
              disabled={
                !pricingResult.pricing || !pickupStore || session === null
              }
              leadingIcon={paymentMethod === "stripe" ? <LockKeyhole /> : <Banknote />}
              onClick={handlePrimaryAction}
            >
              {paymentMethod === "stripe" ? "Pagar con Stripe" : "Pagar en el local"}
            </Button>

            {session === null ? (
              <p className={styles.sessionNotice} role="alert">
                Necesitas una sesión para crear el pedido. <Link href="/acceso">Ir a acceso</Link>
              </p>
            ) : null}
          </>
        ) : null}
      </main>

      <Dialog
        open={cashDialogOpen}
        onClose={() => !submitting && setCashDialogOpen(false)}
        title="Pagar en el local"
        description="Cancela al retirar tu pedido"
        initialFocusSelector="[data-dialog-initial-focus]"
        actions={
          <>
            <Button
              variant="secondary"
              disabled={submitting}
              onClick={() => setCashDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              loading={submitting}
              loadingLabel="Confirmando"
              onClick={() => void createOrder("efectivo")}
            >
              Confirmar efectivo
            </Button>
          </>
        }
      >
        <div className={styles.cashDialog}>
          <div className={styles.cashTotal}>
            <span>Total a pagar</span>
            <strong>{pricingResult.pricing ? formatCop(pricingResult.pricing.totalCop) : "—"}</strong>
          </div>
          <fieldset>
            <legend>Cómo pagarás</legend>
            <label>
              <input
                data-dialog-initial-focus
                type="radio"
                name="cash-choice"
                checked={cashChoice === "exact"}
                disabled={submitting}
                onChange={() => {
                  setCashChoice("exact");
                  setError("");
                }}
              />
              <span>Llevaré el monto exacto</span>
            </label>
            <label>
              <input
                type="radio"
                name="cash-choice"
                checked={cashChoice === "change"}
                disabled={submitting}
                onChange={() => {
                  setCashChoice("change");
                  setError("");
                }}
              />
              <span>Necesito cambio</span>
            </label>
          </fieldset>
          {cashChoice === "change" ? (
            <label className={styles.changeField}>
              <span>Pagaré con</span>
              <input
                type="number"
                inputMode="numeric"
                min={(pricingResult.pricing?.totalCop ?? 0) + 1}
                step="1000"
                value={changeFor}
                disabled={submitting}
                aria-describedby={error ? "payment-error" : undefined}
                onChange={(event) => {
                  setChangeFor(event.target.value);
                  setError("");
                }}
              />
            </label>
          ) : null}
          <p className={styles.cashInfo}>
            Tu pedido quedará confirmado para retiro. El pago permanecerá
            pendiente hasta que canceles en el local.
          </p>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </Dialog>
      <ClientBottomNav active="order" />
    </div>
  );
}
