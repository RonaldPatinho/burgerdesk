import styles from "@/components/admin/AdminReportsScreen.module.css";

export default function AdministratorReportsLoading() {
  return (
    <main id="contenido-principal" className={styles.loadingMain} aria-busy="true">
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={`${styles.skeleton} ${styles.skeletonChart}`} aria-hidden="true" />
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={styles.srOnly}>Cargando reportes</span>
    </main>
  );
}
