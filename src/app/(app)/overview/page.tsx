export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";
import { AccountsCard } from "@/components/overview/accounts-card";
import { GoalsCard } from "@/components/overview/goals-card";
import { ForecastPanel } from "@/components/overview/forecast-panel";
import { getVaultObligations } from "@/lib/queries/vaults";
import { financialMonthYear } from "@/lib/financial-period-utils";

export default async function OverviewPage() {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { month, year } = financialMonthYear(new Date(), startDay);

  const obligations = await getVaultObligations(month, year);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Overview</h1>
      {/* Accounts stays the top primary section — total balance + full
          per-wallet breakdown, liquidity status as an inline pill (no
          top-level banner). */}
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading…</div>}>
        <AccountsCard />
      </Suspense>
      <GoalsCard obligations={obligations} />
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading…</div>}>
        <OverviewDashboard />
      </Suspense>
      {/* De-emphasized supporting detail — last on the page (req 7). */}
      <ForecastPanel month={month} year={year} />
    </div>
  );
}
