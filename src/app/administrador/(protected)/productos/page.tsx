import type { Metadata } from "next";
import { AdminProductsScreen } from "@/components/admin/AdminProductsScreen";
import { listAdminProducts } from "@/server/catalog/admin-repository";
import { listCatalogCategories } from "@/server/catalog/repository";

export const metadata: Metadata = {
  title: "Productos",
  description: "Catálogo de productos administrable de BurgerDesk.",
};

export const dynamic = "force-dynamic";

type ProductSearchParams = {
  q?: string | string[];
};

export interface AdministratorProductsPageProps {
  searchParams: Promise<ProductSearchParams>;
}

export default async function AdministratorProductsPage({
  searchParams,
}: AdministratorProductsPageProps) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const [products, allProducts, categories] = await Promise.all([
    listAdminProducts({ search, includeArchived: false }),
    listAdminProducts({ includeArchived: true }),
    listCatalogCategories(),
  ]);
  const categoryNames = Object.fromEntries(
    categories.map((category) => [category.id, category.name]),
  );

  const archivedProducts = allProducts.filter(
    (product) => product.archivedAt !== null,
  );

  return (
    <AdminProductsScreen
      products={products}
      archivedProducts={archivedProducts}
      categoryNames={categoryNames}
      search={search}
    />
  );
}
