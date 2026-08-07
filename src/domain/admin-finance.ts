export const ADMINISTRATOR_BUSINESS_TIME_ZONE = "America/Caracas";
export const ADMINISTRATOR_DEFAULT_STORE_ID = "sede-principal";

export const administratorFinancialPeriodKinds = ["day", "month"] as const;
export type AdministratorFinancialPeriodKind =
  (typeof administratorFinancialPeriodKinds)[number];

export const administratorPaymentMethodFilters = [
  "all",
  "stripe",
  "efectivo",
] as const;
export type AdministratorPaymentMethodFilter =
  (typeof administratorPaymentMethodFilters)[number];

export const administratorPaymentStatusFilters = [
  "all",
  "pendiente",
  "pendiente_en_efectivo",
  "pagado",
  "expirado",
  "fallido",
] as const;
export type AdministratorPaymentStatusFilter =
  (typeof administratorPaymentStatusFilters)[number];

export type AdministratorPaymentMethod = Exclude<
  AdministratorPaymentMethodFilter,
  "all"
>;
export type AdministratorPaymentStatus = Exclude<
  AdministratorPaymentStatusFilter,
  "all"
>;

export interface AdministratorFinancialPeriod {
  kind: AdministratorFinancialPeriodKind;
  timeZone: string;
  key: string;
  previousKey: string;
  startAt: string;
  endAt: string;
  previousStartAt: string;
  previousEndAt: string;
}

export interface AdministratorFinancialSummary {
  paidSalesCop: number;
  paidOrderCount: number;
  confirmedOrderCount: number;
  averageTicketCop: number;
  previousPaidSalesCop: number;
  salesVariationPercent: number | null;
}

export interface AdministratorSalesSeriesPoint {
  key: string;
  label: string;
  salesCop: number;
  orderCount: number;
}

export interface AdministratorProductRankingItem {
  productId: string;
  productName: string;
  quantitySold: number;
  salesCop: number;
}

export interface AdministratorFinancialSnapshot {
  period: AdministratorFinancialPeriod;
  summary: AdministratorFinancialSummary;
  salesSeries: readonly AdministratorSalesSeriesPoint[];
  topProducts: readonly AdministratorProductRankingItem[];
}

export interface AdministratorTransaction {
  orderId: string;
  orderCode: string;
  paymentMethod: AdministratorPaymentMethod;
  paymentStatus: AdministratorPaymentStatus;
  totalCop: number;
  transactionAt: string;
  confirmedAt: string | null;
}

export interface AdministratorTransactionPage {
  period: AdministratorFinancialPeriod;
  items: readonly AdministratorTransaction[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  paidTotalCop: number;
  filteredPaidTotalCop: number;
}

export interface AdministratorTransactionQueryInput {
  periodKind?: unknown;
  page?: unknown;
  pageSize?: unknown;
  search?: unknown;
  paymentMethod?: unknown;
  paymentStatus?: unknown;
  now?: Date;
  timeZone?: string;
  storeId?: string;
}

export interface NormalizedAdministratorTransactionQuery {
  period: AdministratorFinancialPeriod;
  page: number;
  pageSize: number;
  search: string;
  paymentMethod: AdministratorPaymentMethodFilter;
  paymentStatus: AdministratorPaymentStatusFilter;
  storeId: string;
}

export interface AdministratorPaidSaleEntry {
  occurredAt: string;
  totalCop: number;
}

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = dateTimeFormatters.get(timeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

function zonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date);
  const values = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  const result: ZonedDateTimeParts = {
    year: values.get("year") ?? Number.NaN,
    month: values.get("month") ?? Number.NaN,
    day: values.get("day") ?? Number.NaN,
    hour: values.get("hour") ?? Number.NaN,
    minute: values.get("minute") ?? Number.NaN,
    second: values.get("second") ?? Number.NaN,
  };

  if (Object.values(result).some((value) => !Number.isInteger(value))) {
    throw new RangeError("No fue posible resolver la zona horaria del negocio.");
  }

  return result;
}

function sameDateTimeParts(
  left: ZonedDateTimeParts,
  right: ZonedDateTimeParts,
): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function localDateTimeToUtc(
  desired: ZonedDateTimeParts,
  timeZone: string,
): Date {
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );
  let candidate = desiredAsUtc;

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const actual = zonedDateTimeParts(new Date(candidate), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const difference = desiredAsUtc - actualAsUtc;
    if (difference === 0) break;
    candidate += difference;
  }

  const resolved = new Date(candidate);
  if (!sameDateTimeParts(zonedDateTimeParts(resolved, timeZone), desired)) {
    throw new RangeError("La fecha local no existe en la zona horaria indicada.");
  }
  return resolved;
}

function shiftCalendarDate(
  year: number,
  month: number,
  day: number,
  days: number,
): Pick<ZonedDateTimeParts, "year" | "month" | "day"> {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function shiftCalendarMonth(
  year: number,
  month: number,
  months: number,
): Pick<ZonedDateTimeParts, "year" | "month" | "day"> {
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: 1,
  };
}

function midnight(
  value: Pick<ZonedDateTimeParts, "year" | "month" | "day">,
): ZonedDateTimeParts {
  return { ...value, hour: 0, minute: 0, second: 0 };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function dayKey(value: Pick<ZonedDateTimeParts, "year" | "month" | "day">) {
  return `${value.year}-${pad2(value.month)}-${pad2(value.day)}`;
}

function monthKey(value: Pick<ZonedDateTimeParts, "year" | "month">) {
  return `${value.year}-${pad2(value.month)}`;
}

export function isAdministratorFinancialPeriodKind(
  value: unknown,
): value is AdministratorFinancialPeriodKind {
  return (
    typeof value === "string" &&
    administratorFinancialPeriodKinds.some((kind) => kind === value)
  );
}

export function isAdministratorPaymentMethodFilter(
  value: unknown,
): value is AdministratorPaymentMethodFilter {
  return (
    typeof value === "string" &&
    administratorPaymentMethodFilters.some((method) => method === value)
  );
}

export function isAdministratorPaymentStatusFilter(
  value: unknown,
): value is AdministratorPaymentStatusFilter {
  return (
    typeof value === "string" &&
    administratorPaymentStatusFilters.some((status) => status === value)
  );
}

export function resolveAdministratorFinancialPeriod(input?: {
  kind?: AdministratorFinancialPeriodKind;
  now?: Date;
  timeZone?: string;
}): AdministratorFinancialPeriod {
  const kind = input?.kind ?? "day";
  const now = input?.now ?? new Date();
  const timeZone = input?.timeZone ?? ADMINISTRATOR_BUSINESS_TIME_ZONE;

  if (!isAdministratorFinancialPeriodKind(kind)) {
    throw new RangeError("El período financiero indicado no es válido.");
  }
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("La fecha de referencia no es válida.");
  }

  const current = zonedDateTimeParts(now, timeZone);
  let startLocal: ZonedDateTimeParts;
  let endLocal: ZonedDateTimeParts;
  let previousStartLocal: ZonedDateTimeParts;
  let previousEndLocal: ZonedDateTimeParts;
  let key: string;
  let previousKey: string;

  if (kind === "day") {
    const currentDate = {
      year: current.year,
      month: current.month,
      day: current.day,
    };
    const nextDate = shiftCalendarDate(
      current.year,
      current.month,
      current.day,
      1,
    );
    const previousDate = shiftCalendarDate(
      current.year,
      current.month,
      current.day,
      -1,
    );
    startLocal = midnight(currentDate);
    endLocal = midnight(nextDate);
    previousStartLocal = midnight(previousDate);
    previousEndLocal = startLocal;
    key = dayKey(currentDate);
    previousKey = dayKey(previousDate);
  } else {
    const currentMonth = {
      year: current.year,
      month: current.month,
      day: 1,
    };
    const nextMonth = shiftCalendarMonth(current.year, current.month, 1);
    const previousMonth = shiftCalendarMonth(current.year, current.month, -1);
    startLocal = midnight(currentMonth);
    endLocal = midnight(nextMonth);
    previousStartLocal = midnight(previousMonth);
    previousEndLocal = startLocal;
    key = monthKey(currentMonth);
    previousKey = monthKey(previousMonth);
  }

  return {
    kind,
    timeZone,
    key,
    previousKey,
    startAt: localDateTimeToUtc(startLocal, timeZone).toISOString(),
    endAt: localDateTimeToUtc(endLocal, timeZone).toISOString(),
    previousStartAt: localDateTimeToUtc(
      previousStartLocal,
      timeZone,
    ).toISOString(),
    previousEndAt: localDateTimeToUtc(
      previousEndLocal,
      timeZone,
    ).toISOString(),
  };
}

export function calculateAdministratorVariationPercent(
  currentValue: number,
  previousValue: number,
): number | null {
  if (
    !Number.isFinite(currentValue) ||
    !Number.isFinite(previousValue) ||
    currentValue < 0 ||
    previousValue < 0
  ) {
    throw new RangeError("Los valores comparados deben ser números no negativos.");
  }
  if (previousValue === 0) return null;
  return Math.round(((currentValue - previousValue) / previousValue) * 10_000) / 100;
}

export function calculateAdministratorAverageTicket(
  paidSalesCop: number,
  paidOrderCount: number,
): number {
  if (
    !Number.isSafeInteger(paidSalesCop) ||
    paidSalesCop < 0 ||
    !Number.isSafeInteger(paidOrderCount) ||
    paidOrderCount < 0
  ) {
    throw new RangeError("Las métricas financieras deben ser enteros no negativos.");
  }
  return paidOrderCount === 0 ? 0 : Math.round(paidSalesCop / paidOrderCount);
}

export function createAdministratorSalesSeries(
  period: AdministratorFinancialPeriod,
  entries: readonly AdministratorPaidSaleEntry[],
): AdministratorSalesSeriesPoint[] {
  const startParts = zonedDateTimeParts(new Date(period.startAt), period.timeZone);
  const pointCount =
    period.kind === "day"
      ? 24
      : new Date(Date.UTC(startParts.year, startParts.month, 0)).getUTCDate();

  const points: AdministratorSalesSeriesPoint[] = Array.from(
    { length: pointCount },
    (_, index) => {
      const number = index + 1;
      return period.kind === "day"
        ? {
            key: `${period.key}T${pad2(index)}`,
            label: `${pad2(index)}:00`,
            salesCop: 0,
            orderCount: 0,
          }
        : {
            key: `${period.key}-${pad2(number)}`,
            label: String(number),
            salesCop: 0,
            orderCount: 0,
          };
    },
  );

  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.totalCop) || entry.totalCop < 0) {
      throw new RangeError("La venta debe ser un entero COP no negativo.");
    }
    const occurredAt = new Date(entry.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new RangeError("La fecha de la venta no es válida.");
    }
    const parts = zonedDateTimeParts(occurredAt, period.timeZone);
    const index = period.kind === "day" ? parts.hour : parts.day - 1;
    const point = points[index];
    if (!point) continue;
    point.salesCop += entry.totalCop;
    point.orderCount += 1;
  }

  return points;
}

function normalizedPositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function normalizeAdministratorTransactionQuery(
  input: AdministratorTransactionQueryInput = {},
): NormalizedAdministratorTransactionQuery {
  const periodKind = isAdministratorFinancialPeriodKind(input.periodKind)
    ? input.periodKind
    : "day";
  const timeZone =
    typeof input.timeZone === "string" && input.timeZone.trim()
      ? input.timeZone.trim()
      : ADMINISTRATOR_BUSINESS_TIME_ZONE;
  const storeId =
    typeof input.storeId === "string" && input.storeId.trim()
      ? input.storeId.trim().slice(0, 64)
      : ADMINISTRATOR_DEFAULT_STORE_ID;
  const rawSearch =
    typeof input.search === "string"
      ? input.search.trim().toLowerCase().slice(0, 64)
      : "";
  const search = rawSearch.startsWith("bd-") ? rawSearch.slice(3) : rawSearch;

  return {
    period: resolveAdministratorFinancialPeriod({
      kind: periodKind,
      now: input.now,
      timeZone,
    }),
    page: normalizedPositiveInteger(input.page, 1, 1_000_000),
    pageSize: normalizedPositiveInteger(input.pageSize, 20, 50),
    search,
    paymentMethod: isAdministratorPaymentMethodFilter(input.paymentMethod)
      ? input.paymentMethod
      : "all",
    paymentStatus: isAdministratorPaymentStatusFilter(input.paymentStatus)
      ? input.paymentStatus
      : "all",
    storeId,
  };
}
