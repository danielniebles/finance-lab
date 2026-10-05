export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus } from "lucide-react";
import { BalanceCard } from "@/components/overview/home/balance-card";
import { MonthSnapshot } from "@/components/overview/home/month-snapshot";
import { WalletsStrip } from "@/components/overview/home/wallets-strip";
import { VaultsPanel } from "@/components/overview/home/vaults-panel";
import { ObligationsPanel } from "@/components/overview/home/obligations-panel";
import { SpendingPanel } from "@/components/overview/home/spending-panel";
import { InsightsPanel } from "@/components/overview/home/insights-panel";
import { getWalletBalances } from "@/lib/queries/wallets";
import { getLoansOverview } from "@/lib/queries/loans";
import { getVaultObligations } from "@/lib/queries/vaults";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getMonthSummary } from "@/lib/queries/installments";
import { getForecast } from "@/lib/queries/forecast";
import { financialMonthYear, getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { periodProgress } from "@/lib/forecast-utils";
import { buildHomeInsights } from "@/lib/home-insights";
import { MONTH_NAMES } from "@/lib/format";

// Home: quick access to wallets, vaults and insights for the CURRENT
// financial month (never "last imported month" — import is deprecated).
// Layout: balance + month snapshot → wallets → vaults + obligations →
// spending + insights. See the "Home — refreshed" design artboard.
export default async function OverviewPage() {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { month, year } = financialMonthYear(new Date(), startDay);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);
  const progress = periodProgress(new Date(), start, end);
  const monthLabel = MONTH_NAMES[month - 1];

  const [wallets, loans, obligations, analysis, installments, forecast] = await Promise.all([
    getWalletBalances(),
    getLoansOverview(),
    getVaultObligations(month, year),
    getMonthlyAnalysis(month, year),
    getMonthSummary(month, year),
    getForecast(month, year),
  ]);

  const activeDebtors = loans.debtors.filter((d) => d.totalOwed > 0).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            {monthLabel} {year}
            {progress && ` · day ${progress.daysElapsed} of ${progress.daysInPeriod}`}
          </p>
        </div>
        {/* Plain Link styled like the primary button: buttonVariants lives in a
            "use client" module and can't be called from this server component. */}
        <Link
          href="/expenses?view=ledger"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden />
          Add transaction
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <BalanceCard
          accounts={wallets.accounts}
          grandTotal={wallets.grandTotal}
          liquidityRatio={loans.liquidityRatio}
        />
        <MonthSnapshot
          data={{
            monthLabel: `${monthLabel} ${year}`,
            daysElapsed: progress?.daysElapsed ?? null,
            daysInPeriod: progress?.daysInPeriod ?? null,
            totalIncome: analysis.totalIncome,
            totalExpenses: analysis.totalExpenses,
            totalBudget: analysis.totalBudget,
            realSavings: analysis.realSavings,
            savingsRate: analysis.savingsRate,
            variableBurnRate: analysis.variableBurnRate,
            fixedActual: analysis.fixedActual,
            fixedBudget: analysis.fixedBudget,
          }}
        />
      </div>

      <WalletsStrip accounts={wallets.accounts} />

      <div className="grid gap-4 lg:grid-cols-2">
        <VaultsPanel obligations={obligations} />
        <ObligationsPanel
          monthLabel={monthLabel}
          dueThisMonth={installments.dueThisMonth}
          totalDue={installments.totalDue}
          totalObligation={installments.totalObligation}
          inLoans={loans.inLoans}
          activeDebtors={activeDebtors}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpendingPanel
          monthLabel={monthLabel}
          rows={analysis.categoryBreakdown}
          totalExpenses={analysis.totalExpenses}
        />
        <InsightsPanel insights={buildHomeInsights(analysis.categoryBreakdown)} forecast={forecast} />
      </div>
    </div>
  );
}
