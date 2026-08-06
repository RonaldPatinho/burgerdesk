"use client";

import Image from "next/image";
import { useState } from "react";
import { InternalLogoutDialog } from "@/components/internal/InternalLogoutDialog";
import styles from "./AdminHeader.module.css";

export function AdminHeader({ fullName }: { fullName: string }) {
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
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

          <button
            type="button"
            className={styles.roleButton}
            aria-haspopup="dialog"
            aria-expanded={logoutOpen}
            aria-label={`Abrir opciones de la sesión de ${fullName}`}
            title={fullName}
            onClick={() => setLogoutOpen(true)}
          >
            <span aria-hidden="true" />
            Administrador
          </button>
        </div>
      </header>

      <InternalLogoutDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        endpoint="/api/administrador/auth/logout"
        redirectTo="/administrador/acceso"
        accountLabel="Administrador"
      />
    </>
  );
}
