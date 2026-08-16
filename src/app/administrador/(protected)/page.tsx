import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardScreen } from "@/components/admin/AdminDashboardScreen";
import { getAdministratorFinancialSnapshot } from "@/server/admin-finance/repository";
import { getAuthenticatedAdministratorSession } from "@/server/internal-auth/session";
import { catalogService } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Administrador",
  description: "Resumen administrativo de ventas y pedidos de BurgerDesk.",
};

export const dynamic = "force-dynamic";

export default async function AdministratorDashboardPage() {
  const session = await getAuthenticatedAdministratorSession();
  if (!session) redirect("/administrador/acceso");

  const [snapshot, activeProducts] = await Promise.all([
    getAdministratorFinancialSnapshot({ periodKind: "day" }),
    catalogService.listProducts({ availableOnly: true }),
  ]);

  return (
    <AdminDashboardScreen
      snapshot={snapshot}
      activeProductCount={activeProducts.length}
      enabledQuickActions={["products", "transactions", "reports"]}
    />
  );
}
