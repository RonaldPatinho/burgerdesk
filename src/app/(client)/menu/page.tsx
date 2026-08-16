import type { Metadata } from "next";
import { MenuScreen } from "@/components/client/MenuScreen";
import { catalogService } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Menú",
};

export const dynamic = "force-dynamic";

export interface MenuPageProps {
  searchParams: Promise<{ categoria?: string | string[] }>;
}

function singleValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeCategory(value: string | null): string | null {
  if (value === "clasicas" || value === "especiales") {
    return "burgers";
  }

  return value;
}

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const [params, categories, products, promotions] = await Promise.all([
    searchParams,
    catalogService.listCategories("menu"),
    catalogService.listProducts({ availableOnly: true }),
    catalogService.listPromotions(),
  ]);

  return (
    <MenuScreen
      categories={categories}
      initialProducts={products}
      promotions={promotions}
      initialCategory={normalizeCategory(singleValue(params.categoria))}
    />
  );
}
