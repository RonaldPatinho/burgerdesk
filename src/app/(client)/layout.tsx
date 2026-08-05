import type { ReactNode } from "react";
import { ClientCartProvider } from "@/components/client/ClientCartProvider";

export interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return <ClientCartProvider>{children}</ClientCartProvider>;
}
