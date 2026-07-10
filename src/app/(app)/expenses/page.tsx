export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ImportForm } from "@/components/expenses/import-form";
import { AnalysisDashboard } from "@/components/expenses/analysis-dashboard";
import { PeriodSelector } from "@/components/expenses/period-selector";
import { ViewTabs } from "@/components/expenses/view-tabs";
import { TransactionLedgerPage } from "@/components/expenses/transaction-ledger";
import { getAvailableMonths } from "@/lib/queries/expenses";
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

export default async function ExpensesPage({ searchParams }: Props) {
  const params = await searchParams;
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const fallback = currentFinancialMonth(startDay);

  const selectedMonth = params.month ? parseInt(params.month) : fallback.month;
  const selectedYear = params.year ? parseInt(params.year) : fallback.year;
  const view = params.view === "ledger" ? "ledger" : "analysis";

  const importedMonths = await getAvailableMonths();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-heading text-2xl font-semibold">Expenses</h1>
        <div className="flex items-center gap-3">
          <PeriodSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            startDay={startDay}
            availableMonths={importedMonths}
          />
          <ImportForm />
        </div>
      </div>

      <ViewTabs view={view} month={selectedMonth} year={selectedYear} />

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
            filters={{
              category: params.category || undefined,
              wallet: params.wallet || undefined,
              walletId: params.walletId || undefined,
              type: parseType(params.type),
              search: params.search || undefined,
            }}
          />
        </Suspense>
      ) : (
        <Suspense
          fallback={
            <div className="text-muted-foreground text-sm">Loading analysis…</div>
          }
        >
          <AnalysisDashboard month={selectedMonth} year={selectedYear} />
        </Suspense>
      )}
    </div>
  );
}
