import type { Metadata } from "next";
import { PaymentScreen } from "@/components/client/PaymentScreen";
import { provisionalCatalogService } from "@/services/provisional";

export const metadata: Metadata = {
  title: "Pago seguro",
};

export interface PaymentPageProps {
  searchParams: Promise<{ estado?: string | string[] }>;
}

export default async function PaymentPage({ searchParams }: PaymentPageProps) {
  const [{ estado }, products, stores] = await Promise.all([
    searchParams,
    provisionalCatalogService.listProducts(),
    provisionalCatalogService.listStores(),
  ]);
  const returnState =
    estado === "cancelado" || estado === "expirado" || estado === "fallido"
      ? estado
      : null;

  return (
    <PaymentScreen
      products={products}
      pickupStore={stores[0] ?? null}
      returnState={returnState}
    />
  );
}
