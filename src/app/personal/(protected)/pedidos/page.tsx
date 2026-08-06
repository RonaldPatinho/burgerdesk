import type { Metadata } from "next";
import { ReceiptText, ShieldCheck } from "lucide-react";
import { StaffLogoutButton } from "@/components/staff/StaffLogoutButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Bandeja del personal",
  description: "Bandeja protegida del personal de BurgerDesk.",
};

export default function StaffOrdersPage() {
  return (
    <main id="contenido-principal" className={styles.main}>
      <div className={styles.heading}>
        <h1>Bandeja de pedidos</h1>
        <p>Panel en tiempo real</p>
      </div>

      <section className={styles.placeholder} aria-labelledby="protected-title">
        <span className={styles.placeholderIcon} aria-hidden="true">
          <ReceiptText />
        </span>
        <div>
          <h2 id="protected-title">Acceso verificado</h2>
          <p>
            La sesión interna está activa. La bandeja operativa se incorporará
            en el siguiente hito.
          </p>
        </div>
      </section>

      <section className={styles.securityNotice} aria-labelledby="security-title">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h2 id="security-title">Protección del servidor</h2>
          <p>
            La cuenta y el rol autorizado se comprueban nuevamente al cargar
            esta ruta.
          </p>
        </div>
      </section>

      <StaffLogoutButton />
    </main>
  );
}
