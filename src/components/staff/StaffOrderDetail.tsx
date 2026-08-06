"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { products } from "@/data/provisional";
import { formatCop } from "@/domain/currency";
import {
  isOperationalOrderStatus,
  nextOperationalOrderStatus,
  staffOrderStatusLongLabel,
  type OperationalOrderStatus,
  type StaffOrderDetail,
} from "@/domain/staff-orders";
import styles from "./StaffOrderDetail.module.css";

interface StaffOrderDetailProps {
  initialOrder: StaffOrderDetail;
}

const visibleProgressStatuses = [
  "recibido",
  "en_preparacion",
  "listo_para_retirar",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrderDetail(value: unknown): value is StaffOrderDetail {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.code === "string" &&
    typeof value.customerName === "string" &&
    isOperationalOrderStatus(value.operationalStatus) &&
    Array.isArray(value.lines) &&
    Array.isArray(value.history)
  );
}

function responseMessage(value: unknown): string {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : "No fue posible actualizar el pedido.";
}

function orderTimeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(date);
}

function historyTimeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Hora no disponible";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(date);
}

function productImagePath(productId: string): string | null {
  return products.find((product) => product.id === productId)?.imagePath ?? null;
}

function optionsLabel(
  options: StaffOrderDetail["lines"][number]["options"],
): string {
  return options.length > 0
    ? options.map((option) => option.optionName).join(" · ")
    : "Sin complementos";
}

function paymentLabel(order: StaffOrderDetail): string {
  if (order.paymentStatus === "pagado") return "Pagado";
  if (order.paymentStatus === "pendiente_en_efectivo") return "Efectivo";
  return "Confirmado";
}

function stepState(
  current: OperationalOrderStatus,
  step: (typeof visibleProgressStatuses)[number],
): "completed" | "current" | "upcoming" {
  const currentIndex = visibleProgressStatuses.indexOf(
    current as (typeof visibleProgressStatuses)[number],
  );
  const stepIndex = visibleProgressStatuses.indexOf(step);

  if (current === "entregado") return "completed";
  if (current === "cancelado") return "upcoming";
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export function StaffOrderDetail({ initialOrder }: StaffOrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const nextStatus = useMemo(
    () => nextOperationalOrderStatus(order.operationalStatus),
    [order.operationalStatus],
  );

  async function refreshOrder(): Promise<void> {
    const response = await fetch(
      `/api/personal/orders/${encodeURIComponent(order.id)}`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      },
    );

    if (response.status === 401) {
      router.replace("/personal/acceso");
      router.refresh();
      return;
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body) || !isOrderDetail(body.order)) {
      throw new Error(responseMessage(body));
    }
    setOrder(body.order);
  }

  async function confirmStatusUpdate(): Promise<void> {
    if (!nextStatus || updating) return;

    setUpdating(true);
    setError(null);
    const expectedStatus = order.operationalStatus;

    try {
      const response = await fetch(
        `/api/personal/orders/${encodeURIComponent(order.id)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedStatus, nextStatus }),
        },
      );

      if (response.status === 401) {
        router.replace("/personal/acceso");
        router.refresh();
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          await refreshOrder();
        }
        throw new Error(responseMessage(body));
      }
      if (!isRecord(body) || !isOrderDetail(body.order)) {
        throw new Error("El servidor devolvió un pedido no válido.");
      }

      setOrder(body.order);
      setDialogOpen(false);
      setAnnouncement(
        `Pedido actualizado a ${staffOrderStatusLongLabel(
          body.order.operationalStatus,
        )}.`,
      );
      router.refresh();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible actualizar el pedido.",
      );
    } finally {
      setUpdating(false);
    }
  }

  const terminal = nextStatus === null;
  const terminalMessage =
    order.operationalStatus === "entregado"
      ? "Este pedido ya fue entregado."
      : order.operationalStatus === "cancelado"
        ? "Este pedido fue cancelado."
        : null;

  return (
    <main id="contenido-principal" className={styles.main}>
      <Link className={styles.backLink} href="/personal/pedidos">
        <ArrowLeft aria-hidden="true" />
        <span>Volver</span>
      </Link>

      <div className={styles.titleRow}>
        <h1>Pedido #{order.code}</h1>
        <span className={styles.paymentBadge} data-method={order.paymentMethod}>
          <span aria-hidden="true" />
          {paymentLabel(order)}
        </span>
      </div>

      <section className={styles.customerCard} aria-label="Datos del cliente">
        <span className={styles.customerIcon} aria-hidden="true">
          <UserRound />
        </span>
        <div className={styles.customerCopy}>
          <h2>{order.customerName}</h2>
          <p>
            {order.customerEmail
              ? `${order.customerEmail} · ${order.fulfillmentLabel}`
              : order.fulfillmentLabel}
          </p>
        </div>
        <time dateTime={order.createdAt}>{orderTimeLabel(order.createdAt)}</time>
      </section>

      <section className={styles.section} aria-labelledby="productos-pedido">
        <h2 id="productos-pedido">Productos</h2>
        <div className={styles.productList}>
          {order.lines.map((line) => {
            const imagePath = productImagePath(line.productId);
            return (
              <article key={line.id} className={styles.productCard}>
                <div className={styles.productImageFrame}>
                  {imagePath ? (
                    <Image
                      src={imagePath}
                      alt={line.productName}
                      fill
                      sizes="(max-width: 430px) 28vw, 116px"
                      className={styles.productImage}
                    />
                  ) : (
                    <ReceiptText aria-hidden="true" />
                  )}
                </div>
                <div className={styles.productCopy}>
                  <h3>{line.productName}</h3>
                  <p>{optionsLabel(line.options)}</p>
                </div>
                <div className={styles.productMeta}>
                  <span>× {line.quantity}</span>
                  <strong>{formatCop(line.lineTotalCop)}</strong>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {order.kitchenNote.trim() ? (
        <section className={styles.kitchenNote} aria-labelledby="nota-cocina">
          <CircleAlert aria-hidden="true" />
          <div>
            <h2 id="nota-cocina">Nota para cocina</h2>
            <p>{order.kitchenNote}</p>
          </div>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="estado-pedido">
        <h2 id="estado-pedido">Estado del pedido</h2>
        <ol className={styles.statusSteps}>
          {visibleProgressStatuses.map((status) => {
            const state = stepState(order.operationalStatus, status);
            return (
              <li key={status} data-state={state}>
                {status === "listo_para_retirar"
                  ? "Listo"
                  : staffOrderStatusLongLabel(status)}
              </li>
            );
          })}
        </ol>
      </section>

      <section className={styles.statusNotice} aria-label="Aviso de estado">
        <CircleAlert aria-hidden="true" />
        <p>
          {terminalMessage ?? (
            <>
              El cliente verá el estado actualizado. Confirma antes de avanzar a{" "}
              “{nextStatus ? staffOrderStatusLongLabel(nextStatus) : "—"}”.
            </>
          )}
        </p>
      </section>

      <details className={styles.history}>
        <summary>Historial del estado</summary>
        <ol>
          {order.history.map((entry) => (
            <li key={`${entry.newStatus}-${entry.changedAt}`}>
              <span>{staffOrderStatusLongLabel(entry.newStatus)}</span>
              <time dateTime={entry.changedAt}>
                {historyTimeLabel(entry.changedAt)}
              </time>
            </li>
          ))}
        </ol>
      </details>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button
        className={styles.updateButton}
        fullWidth
        leadingIcon={<Check />}
        disabled={terminal}
        onClick={() => {
          setError(null);
          setDialogOpen(true);
        }}
      >
        {terminal ? "Estado finalizado" : "Actualizar estado"}
      </Button>

      <p className={styles.visuallyHidden} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!updating) setDialogOpen(false);
        }}
        title="Actualizar estado"
        description={`Pedido #${order.code}`}
        closeLabel="Cerrar confirmación de estado"
        actions={
          <>
            <Button
              data-dialog-initial-focus
              variant="secondary"
              disabled={updating}
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              loading={updating}
              loadingLabel="Actualizando"
              onClick={() => void confirmStatusUpdate()}
            >
              Confirmar estado
            </Button>
          </>
        }
      >
        <p className={styles.dialogCopy}>
          El pedido pasará de{" "}
          <strong>{staffOrderStatusLongLabel(order.operationalStatus)}</strong> a{" "}
          <strong>
            {nextStatus ? staffOrderStatusLongLabel(nextStatus) : "estado final"}
          </strong>
          . Esta actualización será visible para el cliente.
        </p>
      </Dialog>
    </main>
  );
}
