import styles from "@/components/admin/AdminStaffScreen.module.css";

export default function AdministratorStaffLoading() {
  return (
    <main id="contenido-principal" className={styles.loadingMain} aria-busy="true">
      <span className={styles.loadingHeading} aria-hidden="true" />
      <span className={styles.loadingToolbar} aria-hidden="true" />
      <div className={styles.loadingCards} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
      </div>
    </main>
  );
}
