import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SkipLink } from "@/components/ui";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";
import styles from "./admin-layout.module.css";

export const dynamic = "force-dynamic";

export default async function AdministratorProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAuthenticatedAdministratorSession();
  if (!session) redirect("/administrador/acceso");

  return (
    <div className={styles.shell}>
      <SkipLink href="#contenido-principal">Saltar al contenido</SkipLink>
      <AdminHeader fullName={session.fullName} />
      {children}
      <AdminBottomNav />
      <div className={styles.desktopRail} aria-hidden="true" />
    </div>
  );
}
