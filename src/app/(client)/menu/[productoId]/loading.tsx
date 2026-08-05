import { ClientHeader } from "@/components/client/ClientHeader";
import { Feedback } from "@/components/ui";
import styles from "./route-state.module.css";

export default function ProductDetailLoading() {
  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <main id="contenido-principal" className={styles.main}>
        <Feedback
          variant="loading"
          title="Cargando producto"
          description="Preparando el detalle y sus opciones."
        />
      </main>
    </div>
  );
}
