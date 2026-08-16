import styles from "@/components/admin/AdminProductsScreen.module.css";

export default function AdministratorProductsLoading() {
  return (
    <main
      id="contenido-principal"
      className={styles.loadingMain}
      aria-busy="true"
      aria-label="Cargando productos"
    >
      <span className={styles.loadingHeading} aria-hidden="true" />
      <span className={styles.loadingSearch} aria-hidden="true" />
      <span className={styles.loadingAction} aria-hidden="true" />
      <div className={styles.loadingCards} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </main>
  );
}
