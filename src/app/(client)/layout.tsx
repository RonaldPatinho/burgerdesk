import type { ReactNode } from "react";
import { ClientCartProvider } from "@/components/client/ClientCartProvider";
import { ClientDesktopSidebar } from "@/components/client/ClientDesktopSidebar";
import { SkipLink } from "@/components/ui";
import styles from "./client-layout.module.css";

export interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <ClientCartProvider>
      <div className={styles.shell}>
        <SkipLink href="#contenido-principal">Saltar al contenido</SkipLink>
        <ClientDesktopSidebar />
        <div className={styles.content}>{children}</div>
      </div>
    </ClientCartProvider>
  );
}
