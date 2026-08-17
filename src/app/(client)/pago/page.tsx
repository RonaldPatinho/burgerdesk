import type { Metadata } from "next";
import { PaymentScreen } from "@/components/client/PaymentScreen";
import { getBusinessSettings } from "@/server/business-settings/repository";
import { catalogService } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Pago seguro",
};

export const dynamic = "force-dynamic";

export interface PaymentPageProps {
  searchParams: Promise<{ estado?: string | string[] }>;
}

export default async function PaymentPage({ searchParams }: PaymentPageProps) {
  const [{ estado }, products, stores, businessSettings] = await Promise.all([
    searchParams,
    catalogService.listProducts(),
    catalogService.listStores(),
    getBusinessSettings().catch(() => null),
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
      checkoutAvailability={
        !businessSettings || !businessSettings.digitalMenuEnabled
          ? {
              state: "unavailable",
              onlinePaymentsEnabled: false,
            }
          : businessSettings.serviceStatus === "closed"
            ? {
                state: "closed",
                onlinePaymentsEnabled: businessSettings.onlinePaymentsEnabled,
              }
            : {
                state: "available",
                onlinePaymentsEnabled: businessSettings.onlinePaymentsEnabled,
              }
      }
    />
  );
}
