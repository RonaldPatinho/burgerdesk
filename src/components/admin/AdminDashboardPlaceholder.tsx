import {
  BadgeCheck,
  ChartNoAxesCombined,
  Database,
  ShieldCheck,
} from "lucide-react";
import styles from "./AdminDashboardPlaceholder.module.css";

export function AdminDashboardPlaceholder() {
  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.heading}>
        <div>
          <h1>Administrador</h1>
          <p>Resumen del negocio</p>
        </div>
        <span className={styles.status}>
          <ShieldCheck aria-hidden="true" />
          Protegido
        </span>
      </header>

      <section className={styles.readyCard} aria-labelledby="admin-ready-title">
        <span className={styles.readyIcon} aria-hidden="true">
          <BadgeCheck />
        </span>
        <div>
          <h2 id="admin-ready-title">Acceso administrativo verificado</h2>
          <p>
            La sesión y el panel protegido ya están listos. Las métricas se
            conectarán a MySQL en el siguiente hito.
          </p>
        </div>
      </section>

      <section className={styles.scope} aria-labelledby="admin-scope-title">
        <h2 id="admin-scope-title">Base preparada</h2>
        <ul>
          <li>
            <Database aria-hidden="true" />
            <span>Sesión interna y autorización exclusiva del administrador.</span>
          </li>
          <li>
            <ChartNoAxesCombined aria-hidden="true" />
            <span>Sin montos, conteos ni gráficos demostrativos.</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
