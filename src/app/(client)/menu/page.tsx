import type { Metadata } from "next";
import { MenuScreen } from "@/components/client/MenuScreen";
import { catalogService } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Menú",
};

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const [categories, products] = await Promise.all([
    catalogService.listCategories("menu"),
    catalogService.listProducts({ availableOnly: true }),
  ]);

  return <MenuScreen categories={categories} initialProducts={products} />;
}
