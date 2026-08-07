import type {
  AdministratorFinancialPeriodKind,
  AdministratorPaymentMethod,
  AdministratorPaymentMethodFilter,
  AdministratorPaymentStatus,
  AdministratorPaymentStatusFilter,
} from "./admin-finance";

export const ADMINISTRATOR_TRANSACTIONS_PATH = "/administrador/transacciones";
export const ADMINISTRATOR_TRANSACTION_PAGE_SIZE = 6;

export type AdministratorTransactionStatusTone =
  | "paid"
  | "pending"
  | "danger";

export interface AdministratorTransactionViewState {
  periodKind: AdministratorFinancialPeriodKind;
  page: number;
  search: string;
  paymentMethod: AdministratorPaymentMethodFilter;
  paymentStatus: AdministratorPaymentStatusFilter;
}

export function administratorTransactionPaymentMethodLabel(
  method: AdministratorPaymentMethod,
): string {
  switch (method) {
    case "stripe":
      return "Pago en línea";
    case "efectivo":
      return "Efectivo";
  }
}

export function administratorTransactionPaymentStatusLabel(
  status: AdministratorPaymentStatus,
): string {
  switch (status) {
    case "pagado":
      return "Pedido pagado";
    case "pendiente_en_efectivo":
      return "Pendiente en efectivo";
    case "pendiente":
      return "Pago pendiente";
    case "expirado":
      return "Pago expirado";
    case "fallido":
      return "Pago fallido";
  }
}

export function administratorTransactionPaymentStatusTone(
  status: AdministratorPaymentStatus,
): AdministratorTransactionStatusTone {
  if (status === "pagado") return "paid";
  if (status === "pendiente" || status === "pendiente_en_efectivo") {
    return "pending";
  }
  return "danger";
}

export function administratorTransactionDateLabel(input: {
  transactionAt: string;
  periodKind: AdministratorFinancialPeriodKind;
  timeZone: string;
}): string {
  const date = new Date(input.transactionAt);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("La fecha de la transacción no es válida.");
  }

  if (input.periodKind === "day") {
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: input.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: input.timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function normalizedPage(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) return 1;
  return value;
}

export function buildAdministratorTransactionsHref(
  state: AdministratorTransactionViewState,
  changes: Partial<AdministratorTransactionViewState> = {},
): string {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();

  if (next.periodKind !== "day") params.set("period", next.periodKind);
  if (next.search) params.set("q", next.search);
  if (next.paymentMethod !== "all") params.set("method", next.paymentMethod);
  if (next.paymentStatus !== "all") params.set("status", next.paymentStatus);

  const page = normalizedPage(next.page);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query
    ? `${ADMINISTRATOR_TRANSACTIONS_PATH}?${query}`
    : ADMINISTRATOR_TRANSACTIONS_PATH;
}

export function administratorTransactionFilterCount(
  state: Pick<
    AdministratorTransactionViewState,
    "search" | "paymentMethod" | "paymentStatus"
  >,
): number {
  let count = 0;
  if (state.search) count += 1;
  if (state.paymentMethod !== "all") count += 1;
  if (state.paymentStatus !== "all") count += 1;
  return count;
}

export function administratorTransactionRangeLabel(input: {
  page: number;
  pageSize: number;
  totalItems: number;
}): string {
  if (input.totalItems === 0) return "0 transacciones";
  const first = (input.page - 1) * input.pageSize + 1;
  const last = Math.min(input.page * input.pageSize, input.totalItems);
  return `${first}–${last} de ${input.totalItems}`;
}
