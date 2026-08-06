import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminAccessScreen } from "@/components/admin/AdminAccessScreen";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";

export const metadata: Metadata = {
  title: "Acceso del administrador",
  description: "Acceso interno al panel administrativo de BurgerDesk.",
};

export const dynamic = "force-dynamic";

export default async function AdministratorAccessPage() {
  const session = await getAuthenticatedAdministratorSession();
  if (session) redirect("/administrador");

  return <AdminAccessScreen />;
}
