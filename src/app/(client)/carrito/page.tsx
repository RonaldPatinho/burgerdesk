import type { Metadata } from "next";
import { CartScreen } from "@/components/client/CartScreen";
import { provisionalCatalogService } from "@/services/provisional";

export const metadata: Metadata = {
  title: "Carrito",
};

export default async function CartPage() {
  const [products, stores] = await Promise.all([
    provisionalCatalogService.listProducts(),
    provisionalCatalogService.listStores(),
  ]);

  return <CartScreen products={products} pickupStore={stores[0] ?? null} />;
}
