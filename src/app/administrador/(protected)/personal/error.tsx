"use client";

import { Button } from "@/components/ui";
import styles from "@/components/admin/AdminStaffScreen.module.css";

export default function AdministratorStaffError({ reset }: { reset: () => void }) {
  return (
    <main id="contenido-principal" className={styles.errorState}>
      <section className={styles.errorCard} role="alert">
        <h1>No pudimos cargar el Personal</h1>
        <p>No se modificó ninguna cuenta. Comprueba la conexión y vuelve a intentarlo.</p>
        <Button type="button" onClick={reset}>Reintentar</Button>
      </section>
    </main>
  );
}
