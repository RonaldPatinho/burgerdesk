"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChartNoAxesCombined,
  House,
  MoreHorizontal,
  ReceiptText,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Dialog } from "@/components/ui";
import styles from "./AdminBottomNav.module.css";

type NavigationItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const primaryItems: readonly NavigationItem[] = [
  { label: "Inicio", href: "/administrador", icon: <House /> },
  { label: "Productos", href: "/administrador/productos", icon: <Boxes /> },
  {
    label: "Ventas",
    href: "/administrador/transacciones",
    icon: <ReceiptText />,
  },
  {
    label: "Reportes",
    href: "/administrador/reportes",
    icon: <ChartNoAxesCombined />,
  },
];

const secondaryItems: readonly NavigationItem[] = [
  { label: "Personal", href: "/administrador/personal", icon: <Users /> },
  {
    label: "Ajustes",
    href: "/administrador/configuracion",
    icon: <Settings />,
  },
];

const desktopItems = [...primaryItems, ...secondaryItems] as const;

function isItemActive(pathname: string, item: NavigationItem): boolean {
  return item.href === "/administrador"
    ? pathname === item.href
    : pathname.startsWith(item.href);
}

function NavigationLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isItemActive(pathname, item);
  return (
    <Link
      href={item.href}
      className={styles.item}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className={styles.icon} aria-hidden="true">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export function AdminBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = secondaryItems.some((item) =>
    isItemActive(pathname, item),
  );

  return (
    <>
      <nav className={styles.nav} aria-label="Navegación del administrador">
        <Link
          className={styles.desktopBrand}
          href="/administrador"
          aria-label="BurgerDesk, ir al resumen administrativo"
        >
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
        </Link>

        <ul className={styles.mobileList}>
          {primaryItems.map((item) => (
            <li key={item.href}>
              <NavigationLink item={item} pathname={pathname} />
            </li>
          ))}
          <li>
            <button
              type="button"
              className={`${styles.item} ${styles.itemButton}`}
              data-active={moreActive || undefined}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            >
              <span className={styles.icon} aria-hidden="true">
                <MoreHorizontal />
              </span>
              <span>Más</span>
            </button>
          </li>
        </ul>

        <ul className={styles.desktopList}>
          {desktopItems.map((item) => (
            <li key={item.href}>
              <NavigationLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>

      <Dialog
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Más opciones"
        description="Gestión del equipo y configuración del local."
        density="compact"
        initialFocusSelector="[data-admin-more-first]"
      >
        <div className={styles.moreMenu}>
          {secondaryItems.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.moreLink}
              data-active={isItemActive(pathname, item) || undefined}
              data-admin-more-first={index === 0 ? "" : undefined}
              onClick={() => setMoreOpen(false)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </Dialog>
    </>
  );
}
