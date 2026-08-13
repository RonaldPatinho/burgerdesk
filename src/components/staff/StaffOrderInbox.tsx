"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock3,
  ReceiptText,
  RefreshCw,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui";
import { products } from "@/data/provisional";
import { formatCop } from "@/domain/currency";
import {
  filterStaffOrders,
  isOperationalOrderStatus,
  staffOrderStatusLabel,
  type StaffInboxFilter,
  type StaffOrderInboxItem,
  type StaffOrderInboxSnapshot,
} from "@/domain/staff-orders";
import styles from "./StaffOrderInbox.module.css";

const POLL_INTERVAL_MS = 15_000;

interface StaffOrderInboxProps {
  staffName: string;
  initialSnapshot: StaffOrderInboxSnapshot;
  initialError?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInboxItem(value: unknown): value is StaffOrderInboxItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.code === "string" &&
    typeof value.createdAt === "string" &&
    isOperationalOrderStatus(value.operationalStatus) &&
    typeof value.totalCop === "number" &&
    Number.isSafeInteger(value.totalCop) &&
    value.totalCop >= 0 &&
    typeof value.lineCount === "number" &&
    typeof value.itemCount === "number" &&
    (typeof value.firstProductId === "string" || value.firstProductId === null) &&
    (typeof value.firstProductName === "string" ||
      value.firstProductName === null) &&
    value.fulfillmentLabel === "Retiro"
  );
}

function isInboxSnapshot(value: unknown): value is StaffOrderInboxSnapshot {
  if (!isRecord(value) || !Array.isArray(value.orders)) return false;
  if (!isRecord(value.indicators)) return false;

  return (
    value.orders.every(isInboxItem) &&
    typeof value.indicators.nuevos === "number" &&
    typeof value.indicators.preparacion === "number" &&
    typeof value.indicators.listos === "number" &&
    typeof value.synchronizedAt === "string"
  );
}

function timeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(date);
}

function itemSummary(order: StaffOrderInboxItem): string {
  const count = order.itemCount;
  return `${count} ${count === 1 ? "producto" : "productos"} · ${order.fulfillmentLabel}`;
}

function productImagePath(productId: string | null): string | null {
  if (!productId) return null;
  return products.find((product) => product.id === productId)?.imagePath ?? null;
}

function emptyCopy(filter: StaffInboxFilter): {
  title: string;
  description: string;
} {
  if (filter === "nuevos") {
    return {
      title: "No hay pedidos nuevos",
      description: "Los pedidos recibidos aparecerán aquí automáticamente.",
    };
  }

  if (filter === "preparacion") {
    return {
      title: "No hay pedidos en preparación",
      description: "Los pedidos que avancen de estado aparecerán en este filtro.",
    };
  }

  return {
    title: "No hay pedidos",
    description: "Los nuevos pedidos aparecerán aquí automáticamente.",
  };
}

const summaryRows = [
  ["nuevos", "Nuevos"],
  ["preparacion", "En preparación"],
  ["listos", "Listos"],
] as const;

export function StaffOrderInbox({
  staffName,
  initialSnapshot,
  initialError = null,
}: StaffOrderInboxProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [filter, setFilter] = useState<StaffInboxFilter>("todos");
  const [error, setError] = useState<string | null>(initialError);
  const [syncing, setSyncing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const requestControllerRef = useRef<AbortController | null>(null);
  const refreshingRef = useRef(false);
  const snapshotRef = useRef(initialSnapshot);

  const refresh = useCallback(
    async (announceEvenWithoutChanges = false) => {
      if (refreshingRef.current) return;

      refreshingRef.current = true;
      setSyncing(true);
      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;

      try {
        const response = await fetch("/api/personal/orders", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/personal/acceso");
          router.refresh();
          return;
        }

        const value: unknown = await response.json().catch(() => null);
        if (
          !response.ok ||
          !isRecord(value) ||
          !isInboxSnapshot(value.snapshot)
        ) {
          throw new Error(
            isRecord(value) && typeof value.message === "string"
              ? value.message
              : "No fue posible actualizar la bandeja de pedidos.",
          );
        }

        const nextSnapshot = value.snapshot;
        const previousCount = snapshotRef.current.orders.length;
        const nextCount = nextSnapshot.orders.length;

        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        setError(null);

        if (announceEvenWithoutChanges || previousCount !== nextCount) {
          setAnnouncement(
            `Bandeja actualizada. ${nextCount} ${
              nextCount === 1 ? "pedido activo" : "pedidos activos"
            }.`,
          );
        }
      } catch (caught: unknown) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "No fue posible actualizar la bandeja de pedidos.",
        );
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
        refreshingRef.current = false;
        setSyncing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    function refreshOnFocus() {
      void refresh();
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, POLL_INTERVAL_MS);

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshOnFocus);
      requestControllerRef.current?.abort();
    };
  }, [refresh]);

  const visibleOrders = useMemo(
    () => filterStaffOrders(snapshot.orders, filter),
    [filter, snapshot.orders],
  );
  const noOrdersCopy = error
    ? {
        title: "No fue posible cargar los pedidos",
        description: error,
      }
    : emptyCopy(filter);

  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.heading}>
            <h1>Bandeja de pedidos</h1>
          </div>

          <div className={styles.profileCard}>
            <div className={styles.profileCopy}>
              <span className={styles.welcomeText}>Hola, {staffName}</span>
              <span className={styles.turnBadge}>
                <span aria-hidden="true" />
                En turno
              </span>
            </div>
            <span className={styles.avatar} aria-hidden="true">
              <UserRound />
            </span>
          </div>
        </div>
      </header>

      <div className={styles.filters} role="group" aria-label="Filtrar pedidos">
        {(
          [
            ["todos", "Todos"],
            ["nuevos", "Nuevos"],
            ["preparacion", "Preparación"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={styles.filterButton}
            data-active={filter === value || undefined}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        <section className={styles.ordersArea} aria-label="Pedidos activos">
          {error && snapshot.orders.length > 0 ? (
            <div className={styles.inlineError} role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void refresh(true)}>
                Reintentar
              </button>
            </div>
          ) : null}

          {visibleOrders.length > 0 ? (
            <div className={styles.orderList}>
              {visibleOrders.map((order) => {
                const imagePath = productImagePath(order.firstProductId);
                const statusLabel = staffOrderStatusLabel(
                  order.operationalStatus,
                );

                return (
                  <Link
                    key={order.id}
                    className={styles.orderCard}
                    data-status={order.operationalStatus}
                    href={`/personal/pedidos/${order.id}`}
                  >
                    <div className={styles.orderImageFrame}>
                      {imagePath ? (
                        <Image
                          src={imagePath}
                          alt={order.firstProductName ?? "Producto del pedido"}
                          fill
                          sizes="(max-width: 768px) 28vw, 120px"
                          className={styles.orderImage}
                        />
                      ) : (
                        <ReceiptText aria-hidden="true" />
                      )}
                    </div>

                    <div className={styles.orderDetails}>
                      <h2>Pedido #{order.code}</h2>
                      <p>{itemSummary(order)}</p>
                      <strong>{formatCop(order.totalCop)}</strong>
                    </div>

                    <div className={styles.orderSide}>
                      <span className={styles.statusBadge}>
                        <span className={styles.statusBadgeDot} aria-hidden="true" />
                        <span className={styles.statusBadgeLabel}>
                          {statusLabel}
                        </span>
                      </span>
                      <time dateTime={order.createdAt}>
                        Pedido - {timeLabel(order.createdAt)}
                      </time>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyStack}>
              <section
                className={styles.emptyState}
                role={error ? "alert" : "status"}
              >
                <span className={styles.emptyIcon} aria-hidden="true">
                  <ReceiptText />
                </span>
                <div>
                  <h2>{noOrdersCopy.title}</h2>
                  <p>{noOrdersCopy.description}</p>
                  {error ? (
                    <div className={styles.retryAction}>
                      <Button
                        type="button"
                        variant="secondary"
                        loading={syncing}
                        loadingLabel="Actualizando"
                        leadingIcon={<RefreshCw />}
                        onClick={() => void refresh(true)}
                      >
                        Reintentar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>

              <section
                className={styles.syncNotice}
                aria-label="Sincronización"
              >
                <Clock3 aria-hidden="true" />
                <div>
                  <h2>Actualización automática</h2>
                  <p>
                    {syncing
                      ? "Sincronizando la bandeja…"
                      : "La bandeja se mantiene sincronizada."}
                  </p>
                </div>
              </section>
            </div>
          )}
        </section>

        <aside className={styles.summaryPanel} aria-label="Resumen de pedidos">
          <h2 className={styles.summaryTitle}>Datos de pedidos</h2>

          <ul className={styles.summaryList}>
            {summaryRows.map(([key, label]) => (
              <li key={key} className={styles.summaryItem} data-tone={key}>
                <span>
                  <span className={styles.summaryDot} aria-hidden="true" />
                  {label}
                </span>
                <strong>{snapshot.indicators[key]}</strong>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            className={styles.actionButton}
            loading={syncing}
            loadingLabel="Actualizando"
            leadingIcon={<RefreshCw />}
            onClick={() => void refresh(true)}
          >
            Actualizar bandeja
          </Button>

          <p className={styles.lastUpdate}>
            Última actualización -{" "}
            {syncing ? "Sincronizando…" : timeLabel(snapshot.synchronizedAt)}
          </p>
        </aside>
      </div>

      <p className={styles.visuallyHidden} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </main>
  );
}
