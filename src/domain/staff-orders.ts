export const operationalOrderStatuses = [
  "recibido",
  "en_preparacion",
  "listo_para_retirar",
  "entregado",
  "cancelado",
] as const;

export type OperationalOrderStatus =
  (typeof operationalOrderStatuses)[number];

export const staffInboxFilters = [
  "todos",
  "nuevos",
  "preparacion",
] as const;

export type StaffInboxFilter = (typeof staffInboxFilters)[number];

export interface StaffOrderInboxItem {
  id: string;
  code: string;
  createdAt: string;
  operationalStatus: OperationalOrderStatus;
  totalCop: number;
  lineCount: number;
  itemCount: number;
  firstProductId: string | null;
  firstProductName: string | null;
  fulfillmentLabel: "Retiro";
}

export interface StaffOrderIndicators {
  nuevos: number;
  preparacion: number;
  listos: number;
}

export interface StaffOrderInboxSnapshot {
  orders: readonly StaffOrderInboxItem[];
  indicators: StaffOrderIndicators;
  synchronizedAt: string;
}

export function isOperationalOrderStatus(
  value: unknown,
): value is OperationalOrderStatus {
  return operationalOrderStatuses.includes(value as OperationalOrderStatus);
}

export function isStaffInboxFilter(value: unknown): value is StaffInboxFilter {
  return staffInboxFilters.includes(value as StaffInboxFilter);
}

export function staffOrderStatusLabel(
  status: OperationalOrderStatus,
): string {
  switch (status) {
    case "recibido":
      return "Nuevo";
    case "en_preparacion":
      return "Preparando";
    case "listo_para_retirar":
      return "Listo";
    case "entregado":
      return "Entregado";
    case "cancelado":
      return "Cancelado";
  }
}

export function staffOrderCode(orderId: string): string {
  return `BD-${orderId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function calculateStaffOrderIndicators(
  orders: readonly Pick<StaffOrderInboxItem, "operationalStatus">[],
): StaffOrderIndicators {
  return orders.reduce<StaffOrderIndicators>(
    (indicators, order) => {
      if (order.operationalStatus === "recibido") indicators.nuevos += 1;
      if (order.operationalStatus === "en_preparacion") {
        indicators.preparacion += 1;
      }
      if (order.operationalStatus === "listo_para_retirar") {
        indicators.listos += 1;
      }
      return indicators;
    },
    { nuevos: 0, preparacion: 0, listos: 0 },
  );
}

export function filterStaffOrders(
  orders: readonly StaffOrderInboxItem[],
  filter: StaffInboxFilter,
): StaffOrderInboxItem[] {
  if (filter === "todos") return [...orders];
  if (filter === "nuevos") {
    return orders.filter((order) => order.operationalStatus === "recibido");
  }
  return orders.filter(
    (order) =>
      order.operationalStatus === "en_preparacion" ||
      order.operationalStatus === "listo_para_retirar",
  );
}
