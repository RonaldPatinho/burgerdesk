import Image from "next/image";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { StaffRole } from "@/domain/internal-auth";
import { getAuthenticatedStaffSession } from "@/server/internal-auth/session";
import styles from "./staff-layout.module.css";

export const dynamic = "force-dynamic";

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "Personal";
}

function roleLabel(role: StaffRole): string {
  if (role === "caja_cocina") return "Caja / Cocina";
  return role === "caja" ? "Caja" : "Cocina";
}

export default async function StaffProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAuthenticatedStaffSession();
  if (!session) redirect("/personal/acceso");

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand} aria-label="BurgerDesk">
            <span className={styles.logoFrame}>
              <Image
                src="/branding/logo-bd.svg"
                alt=""
                width={48}
                height={48}
                priority
              />
            </span>
            <span className={styles.wordmark} aria-hidden="true">
              <span>Burger</span>
              <span>Desk</span>
            </span>
          </div>

          <div className={styles.identity}>
            <div className={styles.identityCopy}>
              <strong>Hola, {firstName(session.fullName)}</strong>
              <span>{roleLabel(session.role)}</span>
            </div>
            <span className={styles.avatar} aria-hidden="true">
              <UserRound />
            </span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
