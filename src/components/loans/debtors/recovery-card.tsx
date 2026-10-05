import { Meter, Money } from "@/components/ds";
import { MASK } from "../lib/constants";

/** Lifetime lending: how much of everything ever lent has come back. */
export function RecoveryCard({
  totalEverLent,
  totalRecovered,
  masked,
}: {
  totalEverLent: number;
  totalRecovered: number;
  masked: boolean;
}) {
  const rate = totalEverLent > 0 ? (totalRecovered / totalEverLent) * 100 : 0;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          Recovered{" "}
          {masked ? MASK : <Money value={totalRecovered} tone="positive" className="font-semibold" />} of{" "}
          {masked ? MASK : <Money value={totalEverLent} className="text-foreground" />} ever lent
        </span>
        <span className="font-mono font-semibold text-foreground">{masked ? MASK : `${rate.toFixed(1)}%`}</span>
      </div>
      {!masked && <Meter value={rate} label="Recovery rate" size="sm" />}
    </div>
  );
}
