"use client";

import { Button } from "@/components/ui";
import styles from "@/components/admin/AdminReportsScreen.module.css";

export default function AdministratorReportsError({ reset }: { reset: () => void }) {
  return (
    <main id="contenido-principal" className={styles.errorState}>
      <section className={styles.errorCard} role="alert">
        <div>
          <h1>No pudimos cargar los reportes</h1>
          <p>Comprueba la conexión y vuelve a intentar la consulta financiera.</p>
        </div>
        <Button type="button" fullWidth onClick={reset}>
          Reintentar
        </Button>
      </section>
    </main>
  );
}
