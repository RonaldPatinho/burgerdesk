import type { Metadata } from "next";
import { AdminProductForm } from "@/components/admin/AdminProductForm";
import { listCatalogCategories } from "@/server/catalog/repository";

export const metadata: Metadata = {
  title: "Nuevo producto",
  description: "Registro de un producto para el menú digital de BurgerDesk.",
};

export const dynamic = "force-dynamic";

const commercialCategoryIds = new Set(["combos", "burgers", "papas", "bebidas"]);

export default async function AdministratorNewProductPage() {
  const categories = (await listCatalogCategories()).filter((category) =>
    commercialCategoryIds.has(category.id),
  );
  return <AdminProductForm mode="create" categories={categories} />;
}
