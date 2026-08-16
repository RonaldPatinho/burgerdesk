import type { Metadata } from "next";
import { HomeScreen } from "@/components/client/HomeScreen";
import { catalogService } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Inicio",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
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
    />
  );
}
