import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Money, SectionHeader, StatusChip } from "@/components/ds";
import type { SpendingPace } from "@/lib/queries/spending-pace";
import { formatWindowRange, paceLabel, pacePercent, pacePoints, walletChangeReasons } from "@/lib/spending-pace-display";
import { TONE_CLASSES, toneForSpendDelta } from "@/lib/status";
import { cn } from "@/lib/utils";
import { CURRENT_COLOR, PaceChart, PREVIOUS_COLOR } from "./pace-chart";

function Legend() {
  const line = (color: string, dashed = false) => (
    <span aria-hidden className={cn("w-4", dashed ? "border-t-2 border-dashed opacity-50" : "h-0.5 rounded-full")} style={dashed ? { borderColor: color } : { backgroundColor: color }} />
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">{line(CURRENT_COLOR)}This period</span>
      <span className="flex items-center gap-1.5">{line(PREVIOUS_COLOR)}Last period</span>
      <span className="flex items-center gap-1.5">{line(PREVIOUS_COLOR, true)}Rest of last period</span>
    </div>
  );
}

function DeltaChip({ delta, percent }: { delta: number; percent: number | null }) {
  const tone = toneForSpendDelta(delta);
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <StatusChip tone={tone}><Icon aria-hidden />{paceLabel(delta)}</StatusChip>
      <span className={cn("font-mono text-sm font-semibold", TONE_CLASSES[tone].text)}>
        <Money value={delta} signed />
        {percent !== null && ` · ${percent > 0 ? "+" : percent < 0 ? "−" : ""}${Math.abs(percent).toFixed(1)}%`}
      </span>
    </span>
  );
}

function WalletBalance({ wallet }: { wallet: NonNullable<SpendingPace["wallet"]> }) {
  const reasons = wallet.change ? walletChangeReasons(wallet.change) : [];
  const diff = wallet.change?.endBalanceDelta ?? 0;
  return (
    <div className="flex flex-col gap-4 self-start rounded-xl bg-muted/50 p-4 sm:p-5">
      <SectionHeader title={`${wallet.name} balance`} as="h3" />
      <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-5 gap-y-2.5 text-sm">
        <span />
        <dt className="text-right text-xs text-muted-foreground">This period</dt>
        <dt className="text-right text-xs text-muted-foreground">Last period</dt>
        <dt className="text-muted-foreground">Opening</dt>
        <dd className="text-right"><Money value={wallet.current.startBalance} /></dd>
        <dd className="text-right text-muted-foreground">{wallet.previous ? <Money value={wallet.previous.startBalance} /> : "—"}</dd>
        <dt className="text-muted-foreground">Today</dt>
        <dd className="text-right font-semibold"><Money value={wallet.current.endBalance} /></dd>
        <dd className="text-right text-muted-foreground">{wallet.previous ? <Money value={wallet.previous.endBalance} /> : "—"}</dd>
      </dl>
      {wallet.change && Math.abs(diff) >= 1 && (
        <div className="flex flex-col gap-2.5 border-t border-border/60 pt-4 text-sm">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium">{diff < 0 ? "Lower by" : "Higher by"}</span>
            <Money value={diff} signed tone={diff < 0 ? "danger" : "positive"} className="font-semibold" />
          </p>
          {reasons.map((r) => (
            <p key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-muted-foreground">{r.label}</span>
              <Money value={r.value} signed />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** The page's one hero: spend so far, the pace chart and (with one wallet) its balance. */
export function PaceHero({ pace, walletName }: { pace: SpendingPace; walletName?: string }) {
  const current = pace.current.totals.spend;
  const previous = pace.previous.totals.spend;
  const delta = current - previous;
  return (
    <section
      className={cn(
        "surface-glow grid gap-6 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 lg:gap-8",
        pace.wallet && "lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]",
      )}
    >
      <div className="flex min-w-0 flex-col gap-5">
        <SectionHeader
          title={`Spending pace · ${walletName ?? "All wallets"}`}
          trailing={
            <span className="text-xs text-muted-foreground">
              {formatWindowRange(pace.current.from, pace.current.until)} vs {formatWindowRange(pace.previous.from, pace.previous.until)}
            </span>
          }
        />
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Spent so far</span>
            <Money value={current} className="text-3xl font-semibold leading-none sm:text-4xl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Same day last period</span>
            <Money value={previous} className="text-lg leading-tight text-muted-foreground" />
          </div>
          <DeltaChip delta={delta} percent={pacePercent(current, previous)} />
        </div>
        <div className="flex flex-col gap-2">
          <Legend />
          <PaceChart points={pacePoints(pace.currentCurve, pace.previousCurve, pace.day)} today={pace.day} />
        </div>
      </div>
      {pace.wallet && <WalletBalance wallet={pace.wallet} />}
    </section>
  );
}
