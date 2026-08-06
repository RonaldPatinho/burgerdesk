import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffAccessScreen } from "@/components/staff/StaffAccessScreen";
import { getAuthenticatedStaffSession } from "@/server/internal-auth/session";

export const metadata: Metadata = {
  title: "Acceso del personal",
  description: "Acceso interno para el personal de BurgerDesk.",
};

export const dynamic = "force-dynamic";

export default async function StaffAccessPage() {
  const session = await getAuthenticatedStaffSession();
  if (session) redirect("/personal/pedidos");

  return <StaffAccessScreen />;
}
