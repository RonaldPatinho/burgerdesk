import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Search,
} from "lucide-react";

import type { AdministratorTransactionPage } from "@/domain/admin-finance";
import { formatCop } from "@/domain/currency";
import {
  administratorTransactionDateLabel,
  administratorTransactionFilterCount,
  administratorTransactionPaymentMethodLabel,
  administratorTransactionPaymentStatusLabel,
  administratorTransactionPaymentStatusTone,
  administratorTransactionRangeLabel,
  buildAdministratorTransactionsHref,
  type AdministratorTransactionViewState,
} from "@/domain/admin-transactions";
import styles from "./AdminTransactionsScreen.module.css";

const methodOptions = [
  ["all", "Todos"],
  ["stripe", "Pago en línea"],
  ["efectivo", "Efectivo"],
] as const;

const statusOptions = [
  ["all", "Todos"],
  ["pagado", "Pagados"],
  ["pendiente_en_efectivo", "Efectivo pendiente"],
  ["pendiente", "Pendientes"],
  ["expirado", "Expirados"],
  ["fallido", "Fallidos"],
] as const;

export function AdminTransactionsScreen({
  transactions,
  viewState,
}: {
  transactions: AdministratorTransactionPage;
  viewState: AdministratorTransactionViewState;
}) {
  const filterCount = administratorTransactionFilterCount(viewState);
  const hasFilters = filterCount > 0;
  const totalLabel =
    transactions.period.kind === "day" ? "Total del día" : "Total del mes";
  const rangeLabel = administratorTransactionRangeLabel({
    page: transactions.page,
    pageSize: transactions.pageSize,
    totalItems: transactions.totalItems,
  });

  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.heading}>
        <h1>Transacciones</h1>
        <p>Historial de pagos</p>
      </header>

      <nav className={styles.periodTabs} aria-label="Período de transacciones">
        <Link
          href={buildAdministratorTransactionsHref(viewState, {
            periodKind: "day",
            page: 1,
          })}
          className={styles.periodTab}
          data-active={transactions.period.kind === "day" || undefined}
          aria-current={transactions.period.kind === "day" ? "page" : undefined}
        >
          Día
        </Link>
        <Link
          href={buildAdministratorTransactionsHref(viewState, {
            periodKind: "month",
            page: 1,
          })}
          className={styles.periodTab}
          data-active={transactions.period.kind === "month" || undefined}
          aria-current={transactions.period.kind === "month" ? "page" : undefined}
        >
          Mes
        </Link>
      </nav>

      <details className={styles.filters} open={hasFilters || undefined}>
        <summary>
          <span>Buscar y filtrar</span>
          {filterCount > 0 ? <strong>{filterCount}</strong> : null}
        </summary>
        <form action="/administrador/transacciones" method="get" className={styles.filterForm}>
          {transactions.period.kind === "month" ? (
            <input type="hidden" name="period" value="month" />
          ) : null}

          <label className={styles.searchField}>
            <span>Pedido</span>
            <span className={styles.searchControl}>
              <Search aria-hidden="true" />
              <input
                type="search"
                name="q"
                defaultValue={viewState.search}
                placeholder="BD-ABCD1234"
                autoComplete="off"
              />
            </span>
          </label>

          <div className={styles.selectGrid}>
            <label>
              <span>Método</span>
              <select name="method" defaultValue={viewState.paymentMethod}>
                {methodOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select name="status" defaultValue={viewState.paymentStatus}>
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.filterActions}>
            <button type="submit">Aplicar</button>
            {hasFilters ? (
              <Link
                href={buildAdministratorTransactionsHref(viewState, {
                  page: 1,
                  search: "",
                  paymentMethod: "all",
                  paymentStatus: "all",
                })}
              >
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>
      </details>

      <section className={styles.history} aria-labelledby="transaction-history-title">
        <div className={styles.historyMeta}>
          <h2 id="transaction-history-title">Movimientos</h2>
          <span>{rangeLabel}</span>
        </div>

        {transactions.items.length > 0 ? (
          <ol className={styles.transactionList}>
            {transactions.items.map((transaction) => {
              const statusLabel = administratorTransactionPaymentStatusLabel(
                transaction.paymentStatus,
              );
              const statusTone = administratorTransactionPaymentStatusTone(
                transaction.paymentStatus,
              );
              const methodLabel = administratorTransactionPaymentMethodLabel(
                transaction.paymentMethod,
              );
              const dateLabel = administratorTransactionDateLabel({
                transactionAt: transaction.transactionAt,
                periodKind: transactions.period.kind,
                timeZone: transactions.period.timeZone,
              });

              return (
                <li key={transaction.orderId} className={styles.transactionCard}>
                  <span className={styles.transactionIcon} aria-hidden="true">
                    <CreditCard />
                  </span>
                  <div className={styles.transactionInfo}>
                    <h3>
                      <span>#{transaction.orderCode}</span>
                      <span aria-hidden="true"> · </span>
                      <span className={styles.statusText} data-tone={statusTone}>
                        {statusLabel}
                      </span>
                    </h3>
                    <p>
                      {methodLabel} · {dateLabel}
                    </p>
                  </div>
                  <strong className={styles.amount}>{formatCop(transaction.totalCop)}</strong>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={styles.emptyState}>
            <CreditCard aria-hidden="true" />
            <div>
              <h3>{hasFilters ? "Sin coincidencias" : "Sin transacciones"}</h3>
              <p>
                {hasFilters
                  ? "No encontramos movimientos con los filtros seleccionados."
                  : "Todavía no hay movimientos registrados en este período."}
              </p>
            </div>
          </div>
        )}
      </section>

      {transactions.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Paginación de transacciones">
          {transactions.page > 1 ? (
            <Link
              href={buildAdministratorTransactionsHref(viewState, {
                page: transactions.page - 1,
              })}
              aria-label="Página anterior"
            >
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true">
              <ChevronLeft aria-hidden="true" />
              Anterior
            </span>
          )}
          <strong>
            Página {transactions.page} de {transactions.totalPages}
          </strong>
          {transactions.page < transactions.totalPages ? (
            <Link
              href={buildAdministratorTransactionsHref(viewState, {
                page: transactions.page + 1,
              })}
              aria-label="Página siguiente"
            >
              Siguiente
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <span aria-disabled="true">
              Siguiente
              <ChevronRight aria-hidden="true" />
            </span>
          )}
        </nav>
      ) : null}

      {hasFilters ? (
        <p className={styles.filteredSummary}>
          Vista filtrada: {transactions.totalItems} movimiento
          {transactions.totalItems === 1 ? "" : "s"} · {formatCop(
            transactions.filteredPaidTotalCop,
          )} pagados
        </p>
      ) : null}

      <section className={styles.totalCard} aria-label={totalLabel}>
        <h2>{totalLabel}</h2>
        <strong>{formatCop(transactions.paidTotalCop)}</strong>
      </section>
    </main>
  );
}
