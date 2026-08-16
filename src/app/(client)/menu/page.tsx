import type { Metadata } from "next";
import { ClientCatalogUnavailable } from "@/components/client/ClientCatalogUnavailable";
import { MenuScreen } from "@/components/client/MenuScreen";
import { customerCatalogIsAvailable } from "@/server/business-settings/policy";
import { getBusinessSettings } from "@/server/business-settings/repository";
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
  const businessSettings = await getBusinessSettings().catch(() => null);
  if (!customerCatalogIsAvailable(businessSettings)) {
    return <ClientCatalogUnavailable />;
  }

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
