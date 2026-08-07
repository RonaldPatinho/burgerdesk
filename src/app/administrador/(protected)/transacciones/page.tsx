import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminTransactionsScreen } from "@/components/admin/AdminTransactionsScreen";
import { normalizeAdministratorTransactionQuery } from "@/domain/admin-finance";
import {
  ADMINISTRATOR_TRANSACTION_PAGE_SIZE,
  buildAdministratorTransactionsHref,
} from "@/domain/admin-transactions";
import { getAdministratorTransactions } from "@/server/admin-finance/repository";

export const metadata: Metadata = {
  title: "Transacciones",
  description: "Historial administrativo de pagos y transacciones de BurgerDesk.",
};

export const dynamic = "force-dynamic";

type TransactionSearchParams = {
  period?: string | string[];
  page?: string | string[];
  q?: string | string[];
  method?: string | string[];
  status?: string | string[];
};

export interface AdministratorTransactionsPageProps {
  searchParams: Promise<TransactionSearchParams>;
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AdministratorTransactionsPage({
  searchParams,
}: AdministratorTransactionsPageProps) {
  const params = await searchParams;
  const now = new Date();
  const normalized = normalizeAdministratorTransactionQuery({
    periodKind: singleValue(params.period),
    page: singleValue(params.page),
    pageSize: ADMINISTRATOR_TRANSACTION_PAGE_SIZE,
    search: singleValue(params.q),
    paymentMethod: singleValue(params.method),
    paymentStatus: singleValue(params.status),
    now,
  });

  const transactions = await getAdministratorTransactions({
    periodKind: normalized.period.kind,
    page: normalized.page,
    pageSize: ADMINISTRATOR_TRANSACTION_PAGE_SIZE,
    search: normalized.search,
    paymentMethod: normalized.paymentMethod,
    paymentStatus: normalized.paymentStatus,
    timeZone: normalized.period.timeZone,
    storeId: normalized.storeId,
    now,
  });

  const viewState = {
    periodKind: normalized.period.kind,
    page: normalized.page,
    search: normalized.search,
    paymentMethod: normalized.paymentMethod,
    paymentStatus: normalized.paymentStatus,
  } as const;

  if (
    transactions.totalPages > 0 &&
    transactions.page > transactions.totalPages
  ) {
    redirect(
      buildAdministratorTransactionsHref(viewState, {
        page: transactions.totalPages,
      }),
    );
  }

  if (transactions.totalPages === 0 && transactions.page > 1) {
    redirect(buildAdministratorTransactionsHref(viewState, { page: 1 }));
  }

  return (
    <AdminTransactionsScreen
      transactions={transactions}
      viewState={viewState}
    />
  );
}
