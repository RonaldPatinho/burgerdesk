"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useClientCart } from "./ClientCartProvider";
import { ClientProfileAvatar } from "./ClientProfileAvatar";
import styles from "./ClientDesktopTopbar.module.css";

export interface ClientDesktopTopbarProps {
  title: string;
  subtitle: string;
}

export function ClientDesktopTopbar({
  title,
  subtitle,
}: ClientDesktopTopbarProps) {
  const { cartCount, status } = useClientCart();
  const cartLabel =
    status === "loading"
      ? "Carrito, cargando cantidad"
      : `Carrito, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}`;

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <nav className={styles.actions} aria-label="Acciones rápidas del cliente">
        <Link className={styles.profile} href="/perfil" aria-label="Abrir perfil">
          <ClientProfileAvatar />
        </Link>

        <Link className={styles.cart} href="/carrito" aria-label={cartLabel}>
          <ShoppingBag aria-hidden="true" />
          <span className={styles.cartCount} aria-hidden="true">
            {cartCount}
          </span>
        </Link>
      </nav>
    </header>
  );
}
