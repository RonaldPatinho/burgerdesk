import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileScreen } from "@/components/client/ProfileScreen";
import { stores } from "@/data/provisional";
import { getAuthenticatedClientSession } from "@/server/auth/session";
import { getClientProfileDashboard } from "@/server/profile/repository";
import { catalogService } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Mi perfil",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getAuthenticatedClientSession();
  if (!session) redirect("/acceso");
  const [dashboard, catalogProducts] = await Promise.all([
    getClientProfileDashboard(session.userId),
    catalogService.listProducts(),
  ]);
  return (
    <ProfileScreen
      initialDashboard={dashboard}
      stores={stores}
      catalogProducts={catalogProducts}
    />
  );
}
