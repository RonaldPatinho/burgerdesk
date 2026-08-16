"use client";

import { Button } from "@/components/ui";
import styles from "@/components/admin/AdminProductsScreen.module.css";

export default function AdministratorProductsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="contenido-principal" className={styles.errorState}>
      <section className={styles.errorCard} role="alert">
        <div>
          <h1>No pudimos cargar los productos</h1>
          <p>
            No se modificó el catálogo. Comprueba la conexión y vuelve a intentar la consulta.
          </p>
        </div>
        <Button type="button" fullWidth onClick={reset}>
          Reintentar
        </Button>
      </section>
    </main>
  );
}
