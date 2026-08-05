import type { Metadata } from "next";
import { OrderConfirmationScreen } from "@/components/client/OrderConfirmationScreen";
import { provisionalCatalogService } from "@/services/provisional";

export const metadata: Metadata = {
  title: "Confirmación del pedido",
};

export interface OrderConfirmationPageProps {
  searchParams: Promise<{
    session_id?: string | string[];
    order_id?: string | string[];
  }>;
}

function singleValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function OrderConfirmationPage({
  searchParams,
}: OrderConfirmationPageProps) {
  const [params, stores] = await Promise.all([
    searchParams,
    provisionalCatalogService.listStores(),
  ]);

  return (
    <OrderConfirmationScreen
      checkoutSessionId={singleValue(params.session_id)}
      orderId={singleValue(params.order_id)}
      pickupStore={stores[0] ?? null}
    />
  );
}
