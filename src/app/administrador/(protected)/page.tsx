import type { Metadata } from "next";
import { AdminDashboardPlaceholder } from "@/components/admin/AdminDashboardPlaceholder";

export const metadata: Metadata = {
  title: "Administrador",
  description: "Panel administrativo protegido de BurgerDesk.",
};

export default function AdministratorDashboardPage() {
  return <AdminDashboardPlaceholder />;
}
