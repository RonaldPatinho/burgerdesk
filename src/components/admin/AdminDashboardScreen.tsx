import Link from "next/link";
import {
  Boxes,
  ChevronRight,
  ChartNoAxesCombined,
  ReceiptText,
} from "lucide-react";
import type { AdministratorFinancialSnapshot } from "@/domain/admin-finance";
import { formatCop } from "@/domain/currency";
import { createAdministratorDashboardQuickActions } from "@/domain/admin-dashboard";
import { AdminDashboardRefresh } from "./AdminDashboardRefresh";
import { AdminSalesChart } from "./AdminSalesChart";
import styles from "./AdminDashboardScreen.module.css";

const quickActionIcons = {
  products: <Boxes />,
  transactions: <ReceiptText />,
  reports: <ChartNoAxesCombined />,
} as const;

export function AdminDashboardScreen({
  snapshot,
  activeProductCount,
  enabledQuickActions = [],
}: {
  snapshot: AdministratorFinancialSnapshot;
  activeProductCount: number;
  enabledQuickActions?: readonly ("products" | "transactions" | "reports")[];
}) {
  const actions = createAdministratorDashboardQuickActions({
    activeProductCount,
    confirmedOrderCount: snapshot.summary.confirmedOrderCount,
  });
  const enabled = new Set(enabledQuickActions);

  return (
    <main id="contenido-principal" className={styles.main}>
      <AdminDashboardRefresh />

      <header className={styles.headingRow}>
        <div className={styles.heading}>
          <h1>Inicio</h1>
          <p>Resumen del negocio</p>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Indicadores de hoy">
        <article className={styles.metricCard}>
          <h2>Ventas</h2>
          <strong>{formatCop(snapshot.summary.paidSalesCop)}</strong>
        </article>
        <article className={styles.metricCard}>
          <h2>Pedidos</h2>
          <strong>{snapshot.summary.confirmedOrderCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <h2>Ticket prom.</h2>
          <strong>{formatCop(snapshot.summary.averageTicketCop)}</strong>
        </article>
      </section>

      <AdminSalesChart
        series={snapshot.salesSeries}
        variationPercent={snapshot.summary.salesVariationPercent}
      />

      <section className={styles.quickSection} aria-labelledby="admin-quick-title">
        <h2 id="admin-quick-title">Accesos rápidos</h2>
        <ul className={styles.quickList}>
          {actions.map((action) => {
            const isEnabled = enabled.has(action.id);
            return (
              <li key={action.id}>
                {isEnabled ? (
                  <Link className={styles.quickAction} href={action.href}>
                    <span className={styles.quickIcon} aria-hidden="true">
                      {quickActionIcons[action.id]}
                    </span>
                    <strong>{action.label}</strong>
                    <span className={styles.quickDetail}>{action.detail}</span>
                    <ChevronRight className={styles.quickChevron} aria-hidden="true" />
                  </Link>
                ) : (
                  <span
                    className={styles.quickAction}
                    data-disabled
                    aria-disabled="true"
                    title={`${action.label}: disponible en próximos hitos`}
                  >
                    <span className={styles.quickIcon} aria-hidden="true">
                      {quickActionIcons[action.id]}
                    </span>
                    <strong>{action.label}</strong>
                    <span className={styles.quickDetail}>{action.detail}</span>
                    <ChevronRight className={styles.quickChevron} aria-hidden="true" />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
