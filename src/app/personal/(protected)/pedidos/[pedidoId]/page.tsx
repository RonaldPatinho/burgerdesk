import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffOrderDetail } from "@/components/staff/StaffOrderDetail";
import { getStaffOrderDetail } from "@/server/staff-orders/repository";

export const metadata: Metadata = {
  title: "Detalle del pedido",
  description: "Detalle operativo de un pedido de BurgerDesk.",
};

interface StaffOrderDetailPageProps {
  params: Promise<{ pedidoId: string }>;
}

export default async function StaffOrderDetailPage({
  params,
}: StaffOrderDetailPageProps) {
  const { pedidoId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) notFound();

  const order = await getStaffOrderDetail(pedidoId);
  if (!order) notFound();

  return <StaffOrderDetail initialOrder={order} />;
}
