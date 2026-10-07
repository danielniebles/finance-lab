import Link from "next/link";
import { AlertTriangle, CircleDashed, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { Money, SectionHeader } from "@/components/ds";
import { PayBills } from "@/components/bills/pay-bills";
import type { WalletOption } from "@/components/shared/wallet-select";
import type { HomeInsight } from "@/lib/home-insights";
import type { BillsForMonth } from "@/lib/queries/bills";
import type { ForecastResult } from "@/lib/queries/forecast";
import { TONE_CLASSES, toneForSavingsRate, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";
import { ledgerCategoryHref } from "./spending-panel";

function InsightIcon({ tone }: { tone: Tone }) {
  if (tone === "info") return <Clock className="size-4" aria-hidden />;
  if (tone === "unplanned") return <CircleDashed className="size-4" aria-hidden />;
  return <AlertTriangle className="size-4" aria-hidden />;
}

type PayBillsProps = { bills: BillsForMonth; walletOptions: WalletOption[] };

function InsightCard({ insight, payBills }: { insight: HomeInsight; payBills: PayBillsProps }) {
  const body = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[insight.tone].soft)}>
        <InsightIcon tone={insight.tone} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{insight.title}</span>
          <Money value={insight.amount} className="text-sm" />
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">{insight.detail}</span>
        {insight.action === "pay-bills" && <span className="text-xs font-semibold text-primary">Pay bills →</span>}
      </span>
    </>
  );
  const classes = "flex gap-3.5 rounded-xl border border-border/60 bg-card p-4";
  if (insight.action === "pay-bills") {
    return (
      <PayBills data={payBills.bills} walletOptions={payBills.walletOptions} className={cn(classes, "w-full cursor-pointer text-left transition-colors hover:bg-muted/40")}>
        {body}
      </PayBills>
    );
  }
  return insight.category ? (
    <Link href={ledgerCategoryHref(insight.category)} className={cn(classes, "transition-colors hover:bg-muted/40")}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

function ForecastCard({ forecast }: { forecast: ForecastResult }) {
  if (forecast.dataSufficiency === "thin" || forecast.projectedSavingsRate === null) {
    return (
      <div className="flex gap-3.5 rounded-xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">
        <Clock className="size-4 shrink-0" aria-hidden />
        Need a few more months of history to forecast.
      </div>
    );
  }
  const rate = forecast.projectedSavingsRate;
  const tone = toneForSavingsRate(rate);
  const Trend = (forecast.vsTarget ?? 0) >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="flex gap-3.5 rounded-xl border border-border/60 bg-card p-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[tone].soft)}>
        <Trend className="size-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">Projected savings rate</span>
          <span className={cn("font-mono text-base font-semibold tabular-nums", TONE_CLASSES[tone].text)}>
            {rate.toFixed(1)}%
          </span>
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {forecast.vsTarget !== null &&
            `${Math.abs(forecast.vsTarget).toFixed(1)} pp ${forecast.vsTarget >= 0 ? "above" : "below"} the ${forecast.savingsRateTarget}% target. `}
          {forecast.pacingMode
            ? "Blends this month's transactions with history · not a guarantee."
            : "Projected from history · not a guarantee."}
        </span>
      </span>
    </div>
  );
}

export function InsightsPanel({
  insights,
  forecast,
  payBills,
}: {
  insights: HomeInsight[];
  forecast: ForecastResult;
  payBills: PayBillsProps;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Insights" href="/chat" linkLabel="Ask Advisor" />
      {insights.map((i) => (
        <InsightCard key={i.key} insight={i} payBills={payBills} />
      ))}
      {insights.length === 0 && (
        <p className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
          Nothing needs attention this month.
        </p>
      )}
      <ForecastCard forecast={forecast} />
    </section>
  );
}
