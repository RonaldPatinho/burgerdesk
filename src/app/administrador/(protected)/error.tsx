"use client";

import { Button } from "@/components/ui";
import styles from "@/components/admin/AdminDashboardScreen.module.css";

export default function AdministratorDashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="contenido-principal" className={styles.errorState}>
      <section className={styles.errorCard} role="alert">
        <div>
          <h1>No pudimos cargar el resumen</h1>
          <p>
            Tus datos no se modificaron. Comprueba la conexión y vuelve a intentar la consulta.
          </p>
        </div>
        <Button type="button" fullWidth onClick={reset}>
          Reintentar
        </Button>
      </section>
    </main>
  );
}
