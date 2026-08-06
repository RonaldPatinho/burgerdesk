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

export interface StaffOrderDetailOption {
  id: string;
  optionId: string;
  optionName: string;
  priceCop: number;
}

export interface StaffOrderDetailLine {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCop: number;
  lineTotalCop: number;
  options: readonly StaffOrderDetailOption[];
}

export interface StaffOrderStatusHistoryEntry {
  previousStatus: OperationalOrderStatus | null;
  newStatus: OperationalOrderStatus;
  changedAt: string;
}

export interface StaffOrderDetail {
  id: string;
  code: string;
  customerName: string;
  customerEmail: string | null;
  fulfillmentLabel: "Retiro";
  paymentMethod: "stripe" | "efectivo";
  paymentStatus:
    | "pendiente"
    | "pendiente_en_efectivo"
    | "pagado"
    | "expirado"
    | "fallido";
  operationalStatus: OperationalOrderStatus;
  subtotalCop: number;
  serviceFeeCop: number;
  totalCop: number;
  kitchenNote: string;
  createdAt: string;
  confirmedAt: string | null;
  lines: readonly StaffOrderDetailLine[];
  history: readonly StaffOrderStatusHistoryEntry[];
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

export function staffOrderStatusLongLabel(
  status: OperationalOrderStatus,
): string {
  switch (status) {
    case "recibido":
      return "Recibido";
    case "en_preparacion":
      return "En preparación";
    case "listo_para_retirar":
      return "Listo para retirar";
    case "entregado":
      return "Entregado";
    case "cancelado":
      return "Cancelado";
  }
}

export function staffOrderCode(orderId: string): string {
  return `BD-${orderId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function nextOperationalOrderStatus(
  currentStatus: OperationalOrderStatus,
): OperationalOrderStatus | null {
  switch (currentStatus) {
    case "recibido":
      return "en_preparacion";
    case "en_preparacion":
      return "listo_para_retirar";
    case "listo_para_retirar":
      return "entregado";
    case "entregado":
    case "cancelado":
      return null;
  }
}

export function canTransitionOperationalOrderStatus(
  currentStatus: OperationalOrderStatus,
  nextStatus: OperationalOrderStatus,
): boolean {
  return nextOperationalOrderStatus(currentStatus) === nextStatus;
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
