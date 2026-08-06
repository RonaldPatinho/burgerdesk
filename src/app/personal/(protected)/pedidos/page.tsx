import type { Metadata } from "next";
import { StaffOrderInbox } from "@/components/staff/StaffOrderInbox";
import type { StaffOrderInboxSnapshot } from "@/domain/staff-orders";
import { getStaffOrderInboxSnapshot } from "@/server/staff-orders/repository";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Bandeja del personal",
  description: "Bandeja operativa del personal de BurgerDesk.",
};

function emptySnapshot(): StaffOrderInboxSnapshot {
  return {
    orders: [],
    indicators: { nuevos: 0, preparacion: 0, listos: 0 },
    synchronizedAt: new Date().toISOString(),
  };
}

export default async function StaffOrdersPage() {
  try {
    const snapshot = await getStaffOrderInboxSnapshot();
    return (
      <div className={styles.page}>
        <StaffOrderInbox initialSnapshot={snapshot} />
      </div>
    );
  } catch {
    return (
      <div className={styles.page}>
        <StaffOrderInbox
          initialSnapshot={emptySnapshot()}
          initialError="No fue posible cargar la bandeja de pedidos."
        />
      </div>
    );
  }
}
