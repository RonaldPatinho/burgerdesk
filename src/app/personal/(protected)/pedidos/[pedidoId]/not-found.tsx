import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import styles from "./not-found.module.css";

export default function StaffOrderNotFound() {
  return (
    <main id="contenido-principal" className={styles.main}>
      <span className={styles.icon} aria-hidden="true">
        <ReceiptText />
      </span>
      <h1>Pedido no encontrado</h1>
      <p>
        El pedido no existe, todavía no fue confirmado o ya no está disponible.
      </p>
      <Link className={styles.link} href="/personal/pedidos">
        <ArrowLeft aria-hidden="true" />
        Volver a la bandeja
      </Link>
    </main>
  );
}
