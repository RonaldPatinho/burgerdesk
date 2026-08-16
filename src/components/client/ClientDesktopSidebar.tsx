"use client";

import Image from "next/image";
import Link from "next/link";
import { House, LayoutGrid, ShoppingBag, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import styles from "./ClientDesktopSidebar.module.css";

const navigationItems = [
  { id: "home", label: "Inicio", href: "/", icon: House },
  { id: "menu", label: "Menú", href: "/menu", icon: LayoutGrid },
  { id: "order", label: "Pedido", href: "/carrito", icon: ShoppingBag },
  { id: "profile", label: "Perfil", href: "/perfil", icon: UserRound },
] as const;

function isNavigationItemActive(
  pathname: string,
  itemId: (typeof navigationItems)[number]["id"],
): boolean {
  if (itemId === "home") return pathname === "/" || pathname === "/acceso";
  if (itemId === "menu") return pathname.startsWith("/menu");
  if (itemId === "order") {
    return (
      pathname.startsWith("/carrito") ||
      pathname.startsWith("/pago") ||
      pathname.startsWith("/pedido")
    );
  }
  return pathname.startsWith("/perfil");
}

export interface ClientDesktopSidebarProps {
  navigationEnabled?: boolean;
}

export function ClientDesktopSidebar({
  navigationEnabled = true,
}: ClientDesktopSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={styles.sidebar}
      aria-label={navigationEnabled ? "Navegación del cliente" : "BurgerDesk"}
    >
      <div className={styles.inner}>
        {navigationEnabled ? (
          <Link className={styles.brand} href="/" aria-label="BurgerDesk, ir al inicio">
            <span className={styles.logoFrame}>
              <Image
                src="/branding/logo-bd.svg"
                alt=""
                width={52}
                height={52}
                priority
              />
            </span>
            <span className={styles.wordmark} aria-hidden="true">
              <span>Burger</span>
              <span>Desk</span>
            </span>
          </Link>
        ) : (
          <div className={styles.brand} aria-label="BurgerDesk">
            <span className={styles.logoFrame}>
              <Image
                src="/branding/logo-bd.svg"
                alt=""
                width={52}
                height={52}
                priority
              />
            </span>
            <span className={styles.wordmark} aria-hidden="true">
              <span>Burger</span>
              <span>Desk</span>
            </span>
          </div>
        )}

        {navigationEnabled ? (
          <nav aria-label="Navegación principal del cliente">
            <ul className={styles.menu}>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const current = isNavigationItemActive(pathname, item.id);

                return (
                  <li key={item.id}>
                    <Link
                      className={styles.item}
                      data-active={current || undefined}
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      prefetch={
                        item.id === "order" || item.id === "profile"
                          ? false
                          : undefined
                      }
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        {navigationEnabled ? <p className={styles.footer}>BurgerDesk</p> : null}
      </div>
    </aside>
  );
}
