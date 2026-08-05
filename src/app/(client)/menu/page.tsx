import type { Metadata } from "next";
import { MenuScreen } from "@/components/client/MenuScreen";
import { provisionalCatalogService } from "@/services/provisional";

export const metadata: Metadata = {
  title: "Menú",
};

export default async function MenuPage() {
  const [categories, products] = await Promise.all([
    provisionalCatalogService.listCategories("menu"),
    provisionalCatalogService.listProducts(),
  ]);

  return <MenuScreen categories={categories} initialProducts={products} />;
}
