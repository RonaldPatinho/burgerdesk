import { UtensilsCrossed } from "lucide-react";
import { Feedback } from "@/components/ui";
import { ClientBottomNav } from "./ClientBottomNav";
import { ClientDesktopTopbar } from "./ClientDesktopTopbar";
import { ClientHeader } from "./ClientHeader";
import styles from "./ClientCatalogUnavailable.module.css";

export function ClientCatalogUnavailable({
  active = "menu",
}: {
  active?: "home" | "menu";
}) {
  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <ClientDesktopTopbar
        title="Menú"
        subtitle="Elige, personaliza y paga sin filas"
      />
      <main id="contenido-principal" className={styles.main}>
        <span className={styles.icon} aria-hidden="true">
          <UtensilsCrossed />
        </span>
        <Feedback
          variant="warning"
          title="Menú digital no disponible"
          description="El catálogo está temporalmente fuera de servicio. Vuelve a intentarlo más tarde."
        />
      </main>
      <ClientBottomNav active={active} />
    </div>
  );
}
