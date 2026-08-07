"use client";

import { Button } from "@/components/ui";
import styles from "@/components/admin/AdminTransactionsScreen.module.css";

export default function AdministratorTransactionsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="contenido-principal" className={styles.errorState}>
      <section className={styles.errorCard} role="alert">
        <div>
          <h1>No pudimos cargar las transacciones</h1>
          <p>
            No se modificó ningún pago. Comprueba la conexión y vuelve a intentar la consulta.
          </p>
        </div>
        <Button type="button" fullWidth onClick={reset}>
          Reintentar
        </Button>
      </section>
    </main>
  );
}
