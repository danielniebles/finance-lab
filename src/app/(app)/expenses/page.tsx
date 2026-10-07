export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { cookies } from "next/headers";
import { AnalysisDashboard } from "@/components/expenses/analysis-dashboard";
import { PeriodSelector } from "@/components/expenses/period-selector";
import { ViewTabs } from "@/components/expenses/view-tabs";
import { TransactionLedgerPage } from "@/components/expenses/transaction-ledger";
import { RememberLedgerWallet, WalletQuickFilter } from "@/components/expenses/wallet-quick-filter";
import { getAvailableMonths } from "@/lib/queries/expenses";
import { getWalletActivity } from "@/lib/queries/transactions";
import { getWalletBalances, type WalletBalancesResult } from "@/lib/queries/wallets";
import { PageHeader } from "@/components/ds";
import { AddTransactionButton } from "@/components/expenses/add-transaction-button";
import { LEDGER_WALLET_COOKIE, resolveLedgerWallet, type WalletChipOption } from "@/lib/expenses-ledger-display";

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

function parseType(value?: string): "expense" | "income" | undefined {
  return value === "expense" || value === "income" ? value : undefined;
}

function parseGroupFilter(value?: string): "FIXED" | "VARIABLE" | undefined {
  return value === "FIXED" || value === "VARIABLE" ? value : undefined;
}

/**
 * Every wallet, account by account in sortOrder — the quick-filter chips'
 * base order. The dot takes the bank's colour, so a bank's wallets read as
 * one family (the wallet's own colour only when the bank has none).
 */
function walletChipOptions(walletBalances: WalletBalancesResult): WalletChipOption[] {
  return walletBalances.accounts.flatMap((account) =>
    account.wallets.map((wallet) => ({ id: wallet.id, name: wallet.name, color: account.color ?? wallet.color })),
  );
}

// ?groupBy= is no longer read: the ledger always groups by day (old URLs still load).
function ledgerFilters(params: Awaited<Props["searchParams"]>, walletId: string | undefined) {
  return {
    category: params.category || undefined,
    wallet: params.wallet || undefined,
    walletId,
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

  const [importedMonths, walletBalances, walletActivity, cookieStore] = await Promise.all([
    getAvailableMonths(),
    getWalletBalances(),
    getWalletActivity(selectedMonth, selectedYear),
    cookies(),
  ]);
  const wallets = walletChipOptions(walletBalances);
  const walletOptions = wallets.map(({ id, name }) => ({ id, name }));
  // The URL wins (`all` = every wallet), else the wallet picked last time.
  const walletId = resolveLedgerWallet(
    params.walletId,
    cookieStore.get(LEDGER_WALLET_COOKIE)?.value,
    wallets.map((w) => w.id),
  );
  const walletName = wallets.find((w) => w.id === walletId)?.name;

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
        action={<AddTransactionButton activeWalletId={walletId} className="max-sm:hidden" />}
      />

      <RememberLedgerWallet walletId={walletId} />
      <div className="flex items-center gap-4">
        <WalletQuickFilter
          wallets={wallets}
          activity={walletActivity}
          selectedId={walletId}
          month={selectedMonth}
          year={selectedYear}
          currentParams={params}
          className="min-w-0 flex-1 max-sm:-mx-6 max-sm:px-6"
        />
        <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">
          Opens on <span className="font-semibold text-foreground">{walletName ?? "All wallets"}</span>
        </span>
      </div>

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
            filters={ledgerFilters(params, walletId)}
            walletBalances={walletBalances}
            wallets={wallets}
            walletActivity={walletActivity}
            currentParams={params}
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
            walletId={walletId}
            groupFilter={parseGroupFilter(params.groupFilter)}
            walletOptions={walletOptions}
          />
        </Suspense>
      )}
    </div>
  );
}
