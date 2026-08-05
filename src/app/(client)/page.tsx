import type { Metadata } from "next";
import { HomeScreen } from "@/components/client/HomeScreen";
import { provisionalCatalogService } from "@/services/provisional";

export const metadata: Metadata = {
  title: "Inicio",
};

export default async function HomePage() {
  const [categories, featuredProducts, promotions] = await Promise.all([
    provisionalCatalogService.listCategories("home"),
    provisionalCatalogService.listFeaturedProducts(),
    provisionalCatalogService.listPromotions(),
  ]);

  return (
    <HomeScreen
      categories={categories}
      featuredProducts={featuredProducts}
      promotions={promotions}
    />
  );
}
