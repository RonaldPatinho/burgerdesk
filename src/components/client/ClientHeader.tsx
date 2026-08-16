"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useClientCart } from "./ClientCartProvider";
import { ClientProfileAvatar } from "./ClientProfileAvatar";
import styles from "./ClientHeader.module.css";

export interface ClientHeaderProps {
  homeLink?: boolean;
}

export function ClientHeader({ homeLink = false }: ClientHeaderProps) {
  const { cartCount, status } = useClientCart();
  const countLabel =
    status === "loading"
      ? "Carrito, cargando cantidad"
      : `Carrito, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}`;
  const brand = (
    <>
      <span className={styles.logoFrame}>
        <Image
          src="/branding/logo-bd.svg"
          alt=""
          width={44}
          height={44}
          priority
        />
      </span>
      <span className={styles.wordmark} aria-hidden="true">
        <span>Burger</span>
        <span>Desk</span>
      </span>
    </>
  );

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {homeLink ? (
          <Link className={styles.brand} href="/" aria-label="Ir al inicio">
            {brand}
          </Link>
        ) : (
          <div className={styles.brand} aria-label="BurgerDesk">
            {brand}
          </div>
        )}
        <nav className={styles.actions} aria-label="Acciones del cliente">
          <Link className={styles.profileLink} href="/perfil" aria-label="Perfil">
            <ClientProfileAvatar />
          </Link>
          <Link className={styles.cartLink} href="/carrito" aria-label={countLabel}>
            <ShoppingBag aria-hidden="true" />
            <span className={styles.cartCount} aria-hidden="true">
              {cartCount}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
