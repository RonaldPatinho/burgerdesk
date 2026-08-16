"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChartNoAxesCombined,
  House,
  ReceiptText,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import styles from "./AdminBottomNav.module.css";

type NavigationItem = {
  label: string;
  href: string;
  icon: ReactNode;
  available: boolean;
};

const items: readonly NavigationItem[] = [
  {
    label: "Inicio",
    href: "/administrador",
    icon: <House />,
    available: true,
  },
  {
    label: "Productos",
    href: "/administrador/productos",
    icon: <Boxes />,
    available: true,
  },
  {
    label: "Ventas",
    href: "/administrador/transacciones",
    icon: <ReceiptText />,
    available: true,
  },
  {
    label: "Reportes",
    href: "/administrador/reportes",
    icon: <ChartNoAxesCombined />,
    available: true,
  },
  {
    label: "Ajustes",
    href: "/administrador/configuracion",
    icon: <Settings />,
    available: false,
  },
];

export function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Navegación del administrador">
      <ul className={styles.list}>
        {items.map((item) => {
          const active =
            item.href === "/administrador"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              {item.available ? (
                <Link
                  href={item.href}
                  className={styles.item}
                  data-active={active || undefined}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={styles.icon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={styles.item}
                  data-disabled
                  aria-disabled="true"
                  title="Disponible en próximos hitos"
                >
                  <span className={styles.icon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
