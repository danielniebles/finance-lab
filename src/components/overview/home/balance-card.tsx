import Link from "next/link";
import { Money, StatusChip } from "@/components/ds";
import type { AccountWithWallets } from "@/lib/queries/wallets";
import { toneForLiquidity } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";
import { walletHref } from "./wallets-strip";

// Kept as an export for existing callers/tests; the rule lives in lib/status.
export const liquidityTone = toneForLiquidity;

type Slice = { id: string; name: string; balance: number; color: string };

// Chart series colors for the allocation bar (DESIGN.md: never status colors).
const SLICE_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-5", "bg-chart-3", "bg-chart-6", "bg-chart-7"];

/** Wallets of accounts counted in the total, positive balances, biggest first. */
export function allocationSlices(accounts: AccountWithWallets[]): Slice[] {
  return accounts
    .filter((a) => a.includeInOverviewTotal)
    .flatMap((a) =>
      a.wallets.map((w) => ({
        id: w.id,
        name: a.wallets.length > 1 ? w.name : a.name,
        balance: w.balance,
        color: "",
      })),
    )
    .filter((s) => s.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map((s, i) => ({ ...s, color: SLICE_CLASSES[i % SLICE_CLASSES.length] }));
}

export function BalanceCard({
  accounts,
  grandTotal,
  liquidityRatio,
}: {
  accounts: AccountWithWallets[];
  grandTotal: number;
  liquidityRatio: number | null;
}) {
  const slices = allocationSlices(accounts);
  const sliceTotal = slices.reduce((s, x) => s + x.balance, 0);
  const liquidity = liquidityRatio !== null ? liquidityTone(liquidityRatio) : null;
  const excluded = accounts.filter((a) => !a.includeInOverviewTotal).map((a) => a.name);

  return (
    <Panel glow className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground font-sans">Available balance</h2>
        {liquidity && (
          <StatusChip tone={liquidity.tone}>
            Liquidity {liquidity.label} · {liquidityRatio!.toFixed(1)}%
          </StatusChip>
        )}
      </div>
      <Money value={grandTotal} tone={grandTotal < 0 ? "danger" : undefined} className="text-4xl font-semibold leading-none max-sm:text-3xl" />

      {slices.length > 0 && sliceTotal > 0 && (
        <div className="flex flex-col gap-3">
          {/* Each segment is a quick link to that wallet's ledger. The legend
              below carries the accessible links; the bar duplicates them for
              pointer users, so it's hidden from the tab order and screen readers. */}
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {slices.map((s) => (
              <Link
                key={s.id}
                href={walletHref(s.id)}
                tabIndex={-1}
                title={s.name}
                className={cn("min-w-1.5 transition-opacity hover:opacity-75", s.color)}
                style={{ flexGrow: s.balance }}
              />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {slices.map((s) => (
              <li key={s.id} className="min-w-0">
                <Link
                  href={walletHref(s.id)}
                  className="-mx-1.5 flex min-w-0 flex-col gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("size-2 shrink-0 rounded-sm", s.color)} />
                    <span className="truncate">{s.name}</span>
                    <span className="tabular-nums">· {Math.round((s.balance / sliceTotal) * 100)}%</span>
                  </span>
                  <Money value={s.balance} className="text-sm font-medium" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {excluded.length > 0 && (
        <p className="mt-auto text-xs text-muted-foreground">Not counted: {excluded.join(", ")}</p>
      )}
    </Panel>
  );
}
