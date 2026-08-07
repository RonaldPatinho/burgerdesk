import styles from "@/components/admin/AdminTransactionsScreen.module.css";

export default function AdministratorTransactionsLoading() {
  return (
    <main
      id="contenido-principal"
      className={styles.loadingMain}
      aria-busy="true"
      aria-label="Cargando transacciones"
    >
      <div className={styles.loadingHeading} aria-hidden="true" />
      <div className={styles.loadingTabs} aria-hidden="true">
        <span />
        <span />
      </div>
      <span className={styles.loadingFilter} aria-hidden="true" />
      <div className={styles.loadingRows} aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <span className={styles.loadingTotal} aria-hidden="true" />
    </main>
  );
}
