export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AnalysisDashboard } from "@/components/expenses/analysis-dashboard";
import { PeriodSelector } from "@/components/expenses/period-selector";
import { ViewTabs } from "@/components/expenses/view-tabs";
import { TransactionLedgerPage } from "@/components/expenses/transaction-ledger";
import { getAvailableMonths, getCategories } from "@/lib/queries/expenses";
import { getTags } from "@/lib/queries/tags";
import { getWalletBalances } from "@/lib/queries/wallets";
import { PageHeader } from "@/components/ds";
import { AddTransactionButton } from "@/components/expenses/add-transaction-button";
import type { LedgerGroupBy } from "@/lib/queries/transactions";

type Props = {
  searchParams: Promise<{
    month?: string;
    year?: string;
    view?: string;
    groupBy?: string;
    category?: string;
    wallet?: string;
    walletId?: string;
    type?: string;
    search?: string;
    groupFilter?: string;
    tagId?: string;
  }>;
};

function currentFinancialMonth(startDay: number) {
  const today = new Date();
  const day = today.getDate();
  let month = today.getMonth() + 1;
  let year = today.getFullYear();
  if (day >= startDay) {
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return { month, year };
}

function parseGroupBy(value?: string): LedgerGroupBy {
  return value === "category" || value === "wallet" ? value : "day";
}

function parseType(value?: string): "expense" | "income" | undefined {
  return value === "expense" || value === "income" ? value : undefined;
}

function parseGroupFilter(value?: string): "FIXED" | "VARIABLE" | undefined {
  return value === "FIXED" || value === "VARIABLE" ? value : undefined;
}

/** What the header's Add transaction dialog needs, on both views. */
async function loadAddTransactionData() {
  const [categories, tags, walletBalances] = await Promise.all([getCategories(), getTags(), getWalletBalances()]);
  const walletOptions = walletBalances.accounts.flatMap((account) =>
    account.wallets.map((wallet) => ({ id: wallet.id, name: wallet.name })),
  );
  return { categories, tags, walletOptions };
}

function ledgerFilters(params: Awaited<Props["searchParams"]>) {
  return {
    category: params.category || undefined,
    wallet: params.wallet || undefined,
    walletId: params.walletId || undefined,
    type: parseType(params.type),
    search: params.search || undefined,
    tagId: params.tagId || undefined,
  };
}

export default async function ExpensesPage({ searchParams }: Props) {
  const params = await searchParams;
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const fallback = currentFinancialMonth(startDay);

  const selectedMonth = params.month ? parseInt(params.month) : fallback.month;
  const selectedYear = params.year ? parseInt(params.year) : fallback.year;
  const view = params.view === "analysis" ? "analysis" : "ledger";

  const [importedMonths, { categories, tags, walletOptions }] = await Promise.all([
    getAvailableMonths(),
    loadAddTransactionData(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        controls={
          <PeriodSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            startDay={startDay}
            availableMonths={importedMonths}
            currentParams={params}
          />
        }
        action={
          <AddTransactionButton
            categories={categories}
            walletOptions={walletOptions}
            tags={tags}
            activeWalletId={params.walletId || undefined}
          />
        }
      />

      <ViewTabs view={view} month={selectedMonth} year={selectedYear} currentParams={params} />

      {view === "ledger" ? (
        <Suspense
          fallback={
            <div className="text-muted-foreground text-sm">Loading ledger…</div>
          }
        >
          <TransactionLedgerPage
            month={selectedMonth}
            year={selectedYear}
            groupBy={parseGroupBy(params.groupBy)}
            filters={ledgerFilters(params)}
          />
        </Suspense>
      ) : (
        <Suspense
          fallback={
            <div className="text-muted-foreground text-sm">Loading analysis…</div>
          }
        >
          <AnalysisDashboard
            month={selectedMonth}
            year={selectedYear}
            walletId={params.walletId || undefined}
            groupFilter={parseGroupFilter(params.groupFilter)}
            walletOptions={walletOptions}
          />
        </Suspense>
      )}
    </div>
  );
}
