import type { Metadata } from "next";
import { AdminSettingsScreen } from "@/components/admin/AdminSettingsScreen";

export const metadata: Metadata = {
  title: "Ajustes",
  description: "Configuración operativa del local BurgerDesk.",
};

export default function AdministratorSettingsPage() {
  return <AdminSettingsScreen />;
}
