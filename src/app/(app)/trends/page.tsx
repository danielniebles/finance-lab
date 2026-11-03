export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { cookies } from "next/headers";
import { TrendsDashboard } from "@/components/trends/trends-dashboard";
import { PeriodToggle } from "@/components/trends/period-toggle";
import { PaceView } from "@/components/trends/pace/pace-view";
import { TrendsViewToggle } from "@/components/trends/view-toggle";
import { WalletQuickFilter } from "@/components/expenses/wallet-quick-filter";
import { PageHeader } from "@/components/ds";
import { LEDGER_WALLET_COOKIE, resolveLedgerWallet } from "@/lib/expenses-ledger-display";
import { financialMonthYear } from "@/lib/financial-period-utils";
import { getWalletActivity } from "@/lib/queries/transactions";
import { getWalletBalances } from "@/lib/queries/wallets";

const PERIOD_WORDS: Record<number, string> = { 3: "three", 6: "six", 12: "twelve" };

type Params = { period?: string; view?: string; walletId?: string };

async function PaceSection({ params }: { params: Params }) {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { month, year } = financialMonthYear(new Date(), startDay);
  const [balances, activity, cookieStore] = await Promise.all([
    getWalletBalances(),
    getWalletActivity(month, year),
    cookies(),
  ]);
  const wallets = balances.accounts.flatMap((account) =>
    account.wallets.map((wallet) => ({ id: wallet.id, name: wallet.name, color: account.color ?? wallet.color })),
  );
  // Same default as the ledger: the URL, else the wallet remembered there.
  // Picking a chip here doesn't change the ledger's remembered wallet.
  const walletId = resolveLedgerWallet(params.walletId, cookieStore.get(LEDGER_WALLET_COOKIE)?.value, wallets.map((w) => w.id));
  return (
    <>
      <WalletQuickFilter
        wallets={wallets}
        activity={activity}
        selectedId={walletId}
        currentParams={{ view: "pace" }}
        basePath="/trends"
        className="max-sm:-mx-6 max-sm:px-6"
      />
      <PaceView walletId={walletId} walletName={wallets.find((w) => w.id === walletId)?.name} />
    </>
  );
}

export default async function TrendsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const view = params.view === "months" ? "months" : "pace";
  const period = params.period === "3" ? 3 : params.period === "12" ? 12 : 6;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trends"
        description={
          view === "pace"
            ? "This period so far, against the same days last period"
            : `How the last ${PERIOD_WORDS[period]} months compare`
        }
        controls={
          <>
            <TrendsViewToggle current={view} walletId={params.walletId} period={period} />
            {view === "months" && <PeriodToggle current={period} />}
          </>
        }
      />
      {view === "pace" ? (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading pace…</div>}>
          <PaceSection params={params} />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading trends…</div>}>
          <TrendsDashboard period={period} />
        </Suspense>
      )}
    </div>
  );
}
