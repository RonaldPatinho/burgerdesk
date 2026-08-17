import type { Metadata } from "next";
import { ClientCatalogUnavailable } from "@/components/client/ClientCatalogUnavailable";
import { HomeScreen } from "@/components/client/HomeScreen";
import { customerCatalogIsAvailable } from "@/server/business-settings/policy";
import { getBusinessSettings } from "@/server/business-settings/repository";
import { catalogService } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Inicio",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const businessSettings = await getBusinessSettings().catch(() => null);
  if (!customerCatalogIsAvailable(businessSettings)) {
    return <ClientCatalogUnavailable active="home" />;
  }

  const [categories, featuredProducts, desktopCategories, desktopProducts, promotions] =
    await Promise.all([
      catalogService.listCategories("home"),
      catalogService.listFeaturedProducts(),
      catalogService.listCategories("menu"),
      catalogService.listProducts({ availableOnly: true }),
      catalogService.listPromotions(),
    ]);

  return (
    <HomeScreen
      categories={categories}
      featuredProducts={featuredProducts}
      desktopCategories={desktopCategories}
      desktopProducts={desktopProducts}
      promotions={promotions}
      customerMessage={businessSettings.customerMessage}
    />
  );
}
