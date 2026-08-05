import Link from "next/link";
import { House, LayoutGrid, ShoppingBag, UserRound } from "lucide-react";
import styles from "./ClientBottomNav.module.css";

export type ClientNavigationItem = "home" | "menu" | "order" | "profile";

export interface ClientBottomNavProps {
  active: ClientNavigationItem;
}

const navigationItems = [
  { id: "home", label: "Inicio", href: "/", icon: House },
  { id: "menu", label: "Menú", href: "/menu", icon: LayoutGrid },
  { id: "order", label: "Pedido", href: "/carrito", icon: ShoppingBag },
  { id: "profile", label: "Perfil", href: "/perfil", icon: UserRound },
] as const;

export function ClientBottomNav({ active }: ClientBottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="Navegación principal del cliente">
      <div className={styles.inner}>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const current = item.id === active;

          return (
            <Link
              key={item.id}
              className={styles.item}
              data-active={current || undefined}
              href={item.href}
              aria-current={current ? "page" : undefined}
              prefetch={item.id === "order" || item.id === "profile" ? false : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
              {current ? <span className={styles.activeDot} aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
