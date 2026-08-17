import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminProductForm } from "@/components/admin/AdminProductForm";
import { getAdminProduct } from "@/server/catalog/admin-repository";
import { listCatalogCategories } from "@/server/catalog/repository";

export const metadata: Metadata = {
  title: "Editar producto",
  description: "Edición de un producto del menú digital de BurgerDesk.",
};

export const dynamic = "force-dynamic";

const commercialCategoryIds = new Set(["combos", "burgers", "papas", "bebidas"]);

export default async function AdministratorEditProductPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  const [product, allCategories] = await Promise.all([
    getAdminProduct(productoId),
    listCatalogCategories(),
  ]);
  if (!product || product.archivedAt) notFound();
  const categories = allCategories.filter((category) =>
    commercialCategoryIds.has(category.id),
  );
  return (
    <AdminProductForm
      mode="edit"
      categories={categories}
      initialProduct={product}
    />
  );
}
