import styles from "@/components/admin/AdminDashboardScreen.module.css";

export default function AdministratorDashboardLoading() {
  return (
    <main
      id="contenido-principal"
      className={styles.loadingMain}
      aria-busy="true"
      aria-label="Cargando resumen administrativo"
    >
      <div className={styles.skeletonTop} aria-hidden="true">
        <span className={styles.skeletonHeading} />
        <span className={styles.skeletonPill} />
      </div>
      <div className={styles.skeletonMetrics} aria-hidden="true">
        <span className={styles.skeletonMetric} />
        <span className={styles.skeletonMetric} />
        <span className={styles.skeletonMetric} />
      </div>
      <span className={styles.skeletonChart} aria-hidden="true" />
      <div className={styles.skeletonRows} aria-hidden="true">
        <span className={styles.skeletonRow} />
        <span className={styles.skeletonRow} />
        <span className={styles.skeletonRow} />
      </div>
    </main>
  );
}
