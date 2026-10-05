import { Meter, Money } from "@/components/ds";
import type { VaultObligations } from "@/lib/queries/vaults";
import { TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";

// One "this month" summary replacing the old due banner + three stat cells,
// which listed the same vaults the tiles below already show.

function fundedPct(o: VaultObligations): number {
  if (o.totalRequired <= 0) return 100;
  return Math.max(0, Math.min(100, ((o.totalRequired - o.totalStillNeeded) / o.totalRequired) * 100));
}

function GapCard({
  label,
  amount,
  detail,
  urgent,
}: {
  label: string;
  amount: number;
  detail: string;
  urgent: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl px-4 py-3.5",
        urgent ? TONE_CLASSES.danger.soft : "border border-border/60 bg-background",
      )}
    >
      <span className={cn("text-xs font-semibold", urgent ? undefined : "text-muted-foreground")}>{label}</span>
      <Money value={amount} className="text-xl font-semibold" />
      <span className={cn("text-xs", urgent ? "opacity-80" : "text-muted-foreground")}>{detail}</span>
    </div>
  );
}

export function VaultsSummary({ obligations }: { obligations: VaultObligations }) {
  const { totalRequired, totalStillNeeded, mandatoryStillNeeded, vaults } = obligations;
  const pct = fundedPct(obligations);
  const needing = vaults.filter((v) => v.stillNeeded > 0);
  const mandatory = needing.filter((v) => v.kind === "MANDATORY").map((v) => v.name);
  const leisure = needing.filter((v) => v.kind !== "MANDATORY").map((v) => v.name);
  const done = totalStillNeeded <= 0;

  return (
    <section
      aria-labelledby="vaults-month-heading"
      className="surface-glow grid gap-6 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 lg:grid-cols-2 lg:items-center"
    >
      <div className="flex flex-col gap-3">
        <h2 id="vaults-month-heading" className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          To set aside this month
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Money value={totalStillNeeded} tone={done ? "positive" : undefined} className="text-4xl font-semibold leading-none max-sm:text-3xl" />
          <span className="text-sm text-muted-foreground">
            of <Money value={totalRequired} className="text-foreground" /> still needed
          </span>
        </div>
        <Meter label="Funded this month" value={pct} max={100} tone={done ? "positive" : "caution"} />
        <span className="text-xs text-muted-foreground">
          {done
            ? "Every vault is funded for this month."
            : `${Math.round(pct)}% funded · ${needing.length} ${needing.length === 1 ? "vault needs" : "vaults need"} money`}
        </span>
      </div>
      {!done && (
        <div className="grid grid-cols-2 gap-3">
          <GapCard
            label="Mandatory gap"
            amount={mandatoryStillNeeded}
            detail={mandatory.length > 0 ? `${mandatory.join(", ")} · fund first` : "Covered"}
            urgent={mandatoryStillNeeded > 0}
          />
          <GapCard
            label="Leisure"
            amount={totalStillNeeded - mandatoryStillNeeded}
            detail={leisure.length > 0 ? leisure.join(", ") : "Covered"}
            urgent={false}
          />
        </div>
      )}
    </section>
  );
}
