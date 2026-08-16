import type { Metadata } from "next";
import { StaffOrderInbox } from "@/components/staff/StaffOrderInbox";
import type { StaffOrderInboxSnapshot } from "@/domain/staff-orders";
import { staffAutomaticRefreshIsEnabled } from "@/server/business-settings/policy";
import { getBusinessSettings } from "@/server/business-settings/repository";
import { getAuthenticatedStaffSession } from "@/server/internal-auth/session";
import { getStaffOrderInboxSnapshot } from "@/server/staff-orders/repository";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Bandeja del personal",
  description: "Bandeja operativa del personal de BurgerDesk.",
};

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "Personal";
}

function emptySnapshot(): StaffOrderInboxSnapshot {
  return {
    orders: [],
    indicators: { nuevos: 0, preparacion: 0, listos: 0 },
    synchronizedAt: new Date().toISOString(),
  };
}

export default async function StaffOrdersPage() {
  const [session, snapshotOrError, businessSettings] = await Promise.all([
    getAuthenticatedStaffSession(),
    getStaffOrderInboxSnapshot().then(
      (snapshot) => ({ snapshot }) as const,
      () => ({ error: "No fue posible cargar la bandeja de pedidos." }) as const,
    ),
    getBusinessSettings().catch(() => null),
  ]);

  const snapshot =
    "error" in snapshotOrError ? emptySnapshot() : snapshotOrError.snapshot;
  const initialError = "error" in snapshotOrError ? snapshotOrError.error : null;

  return (
    <div className={styles.page}>
      <StaffOrderInbox
        staffName={session ? firstName(session.fullName) : "Personal"}
        initialSnapshot={snapshot}
        initialError={initialError}
        automaticRefreshEnabled={staffAutomaticRefreshIsEnabled(businessSettings)}
      />
    </div>
  );
}
