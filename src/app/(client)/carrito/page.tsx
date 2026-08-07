import type { Metadata } from "next";
import { CartScreen } from "@/components/client/CartScreen";
import { catalogService } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Carrito",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [products, stores] = await Promise.all([
    catalogService.listProducts(),
    catalogService.listStores(),
  ]);

  return <CartScreen products={products} pickupStore={stores[0] ?? null} />;
}
