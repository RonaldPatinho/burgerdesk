import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailScreen } from "@/components/client/ProductDetailScreen";
import { isProductId } from "@/domain/validation";
import { catalogService } from "@/services/catalog";

interface ProductDetailPageProps {
  params: Promise<{ productoId: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { productoId } = await params;

  if (!isProductId(productoId)) {
    return { title: "Producto" };
  }

  const product = await catalogService.getProduct(productoId);
  return { title: product?.name ?? "Producto" };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { productoId } = await params;

  if (!isProductId(productoId)) {
    notFound();
  }

  const [product, availableProducts] = await Promise.all([
    catalogService.getProduct(productoId),
    catalogService.listProducts({ availableOnly: true }),
  ]);

  if (!product || !product.available) {
    notFound();
  }

  const recommendations = availableProducts
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, 4);

  return (
    <ProductDetailScreen
      product={product}
      recommendations={recommendations}
    />
  );
}
