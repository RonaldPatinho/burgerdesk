import Link from "next/link";
import { ClientHeader } from "@/components/client/ClientHeader";
import { Feedback } from "@/components/ui";
import styles from "./route-state.module.css";

export default function ProductNotFound() {
  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <main id="contenido-principal" className={styles.main}>
        <Feedback
          variant="empty"
          title="Producto no encontrado"
          description="Este producto no forma parte del menú provisional."
          action={
            <Link className={styles.action} href="/menu">
              Volver al menú
            </Link>
          }
        />
      </main>
    </div>
  );
}
