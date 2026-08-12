"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReceiptText, UserRound } from "lucide-react";
import { StaffLogoutButton } from "@/components/staff/StaffLogoutButton";
import styles from "./StaffBottomNav.module.css";

interface StaffBottomNavProps {
  roleLabel: string;
}

export function StaffBottomNav({ roleLabel }: StaffBottomNavProps) {
  const pathname = usePathname();
  const ordersActive = pathname.startsWith("/personal/pedidos");

  return (
    <nav className={styles.nav} aria-label="Navegación principal del personal">
      <div className={styles.inner}>
        <div className={styles.brand} aria-label="BurgerDesk">
          <span className={styles.logoFrame}>
            <Image
              src="/branding/logo-bd.svg"
              alt=""
              width={48}
              height={48}
              priority
            />
          </span>
          <span className={styles.wordmark} aria-hidden="true">
            <span>Burger</span>
            <span>Desk</span>
          </span>
        </div>

        <ul className={styles.menu}>
          <li>
            <Link
              className={styles.item}
              data-active={ordersActive || undefined}
              href="/personal/pedidos"
              aria-current={ordersActive ? "page" : undefined}
            >
              <ReceiptText aria-hidden="true" />
              <span>Bandeja de pedidos</span>
              {ordersActive ? (
                <span className={styles.activeDot} aria-hidden="true" />
              ) : null}
            </Link>
          </li>
          <li>
            <span
              className={styles.item}
              data-disabled="true"
              aria-disabled="true"
              title="El perfil se habilitará en el hito P4"
            >
              <UserRound aria-hidden="true" />
              <span>Perfil</span>
            </span>
          </li>
        </ul>

        <div className={styles.footerNav}>
          <span className={styles.roleItem}>
            <span className={styles.roleDot} aria-hidden="true" />
            <span>{roleLabel}</span>
          </span>
          <StaffLogoutButton
            variant="ghost"
            inverse
            className={styles.logoutButton}
          />
        </div>
      </div>
    </nav>
  );
}
