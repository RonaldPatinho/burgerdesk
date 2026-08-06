"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReceiptText, UserRound } from "lucide-react";
import styles from "./StaffBottomNav.module.css";

export function StaffBottomNav() {
  const pathname = usePathname();
  const ordersActive = pathname.startsWith("/personal/pedidos");

  return (
    <nav className={styles.nav} aria-label="Navegación principal del personal">
      <div className={styles.inner}>
        <Link
          className={styles.item}
          data-active={ordersActive || undefined}
          href="/personal/pedidos"
          aria-current={ordersActive ? "page" : undefined}
        >
          <ReceiptText aria-hidden="true" />
          <span>Bandeja</span>
          {ordersActive ? (
            <span className={styles.activeDot} aria-hidden="true" />
          ) : null}
        </Link>

        <span
          className={styles.item}
          data-disabled="true"
          aria-disabled="true"
          title="El perfil se habilitará en el hito P4"
        >
          <UserRound aria-hidden="true" />
          <span>Perfil</span>
        </span>
      </div>
    </nav>
  );
}
