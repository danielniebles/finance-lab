import { Money, StatusChip } from "@/components/ds";
import { netWorthComposition } from "@/lib/loan-display";
import { toneForLiquidity } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { LoansOverview } from "@/lib/queries/loans";
import { MASK } from "./lib/constants";

function Amount({ value, masked, className }: { value: number; masked: boolean; className?: string }) {
  if (masked) return <span className={cn("font-mono", className)}>{MASK}</span>;
  return <Money value={value} tone={value < 0 ? "danger" : undefined} className={className} />;
}

/**
 * Headline of the Savings & Loans page: net worth, and how it splits between
 * money you can use (available), money lent out and money earmarked in vaults.
 * Replaces the old six-card KPI strip — "Total savings" is available + lent,
 * so it now reads straight off the bar instead of being its own card.
 */
export function NetWorthCard({
  data,
  masked,
  activeDebtorCount,
}: {
  data: Pick<LoansOverview, "netWorth" | "available" | "inLoans" | "inVaults" | "totalSavings" | "liquidityRatio">;
  masked: boolean;
  activeDebtorCount: number;
}) {
  const parts = netWorthComposition(data);
  const liquidity = data.liquidityRatio !== null ? toneForLiquidity(data.liquidityRatio) : null;
  const subs: Record<string, string> = {
    available: "liquid accounts",
    loans: `${activeDebtorCount} active debtor${activeDebtorCount === 1 ? "" : "s"}`,
    vaults: "earmarked from accounts",
  };

  return (
    <section className="surface-glow flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-sans text-sm font-medium text-muted-foreground">Net worth</h2>
          <Amount value={data.netWorth} masked={masked} className="text-4xl font-semibold leading-none max-sm:text-3xl" />
          <p className="text-xs text-muted-foreground">
            Savings <Amount value={data.totalSavings} masked={masked} className="text-foreground" /> + vaults
          </p>
        </div>
        {liquidity && !masked && (
          <StatusChip tone={liquidity.tone}>
            Liquidity {liquidity.label} · {data.liquidityRatio!.toFixed(1)}%
          </StatusChip>
        )}
      </div>

      {!masked && (
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-meter-track" aria-hidden>
          {parts
            .filter((p) => p.pct > 0)
            .map((p) => (
              <span key={p.key} className={cn("min-w-1.5", p.fill)} style={{ flexGrow: p.pct }} title={p.label} />
            ))}
        </div>
      )}

      <ul className="grid gap-2.5 sm:grid-cols-3 sm:gap-4">
        {parts.map((p) => (
          // Phones: one line per part (label · value); sm+: three columns.
          <li key={p.key} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 sm:flex-col sm:justify-start sm:gap-0.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", p.fill)} />
              {p.label}
              {!masked && <span className="font-mono">{Math.round(p.pct)}%</span>}
            </span>
            <Amount value={p.value} masked={masked} className="font-semibold sm:text-lg" />
            <span className="hidden text-xs text-muted-foreground sm:block">{subs[p.key]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
