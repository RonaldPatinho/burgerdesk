import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailScreen } from "@/components/client/ProductDetailScreen";
import { productIds } from "@/domain/models";
import { isProductId } from "@/domain/validation";
import { provisionalCatalogService } from "@/services/provisional";

interface ProductDetailPageProps {
  params: Promise<{ productoId: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return productIds.map((productoId) => ({ productoId }));
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { productoId } = await params;

  if (!isProductId(productoId)) {
    return { title: "Producto" };
  }

  const product = await provisionalCatalogService.getProduct(productoId);
  return { title: product?.name ?? "Producto" };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { productoId } = await params;

  if (!isProductId(productoId)) {
    notFound();
  }

  const product = await provisionalCatalogService.getProduct(productoId);

  if (!product) {
    notFound();
  }

  return <ProductDetailScreen product={product} />;
}
