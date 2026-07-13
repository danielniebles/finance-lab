import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";
import { getWalletBalances } from "@/lib/queries/wallets";
import { getLoansOverview } from "@/lib/queries/loans";
import type { AccountWithWallets, WalletBalance } from "@/lib/queries/wallets";

// ─── Shared row primitives ─────────────────────────────────────────────────────

export function walletHref(walletId: string): string {
  return `/expenses?view=ledger&walletId=${encodeURIComponent(walletId)}`;
}

function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="size-3 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? "#888" }}
    />
  );
}

function BalanceText({
  balance,
  weight = "normal",
}: {
  balance: number;
  weight?: "normal" | "semibold";
}) {
  return (
    <span
      className={cn(
        "font-mono text-sm tabular-nums shrink-0",
        weight === "semibold" ? "font-semibold" : "font-normal",
        balance < 0 ? "text-destructive" : "text-foreground"
      )}
    >
      {formatCOP(balance)}
    </span>
  );
}

// ─── Grand total + liquidity pill ────────────────────────────────────────────
// The liquidity status used to live as a full "Liquidity Health" zone inside
// a separate Loans card. Per the Overview redesign (req 1), it's now a small
// always-visible pill next to Total Balance instead — no top-level banner,
// no dedicated section, just a low-footprint signal.

function classifyLiquidity(ratio: number): { label: string; dotClass: string; toneClass: string } {
  if (ratio < 30) return { label: "critical", dotClass: "bg-destructive", toneClass: "text-destructive bg-destructive/10" };
  if (ratio < 50) return { label: "warning", dotClass: "bg-warning", toneClass: "text-warning bg-warning/10" };
  return { label: "healthy", dotClass: "bg-success", toneClass: "text-success bg-success/10" };
}

function LiquidityPill({ ratio }: { ratio: number | null }) {
  if (ratio === null) return null;
  const { label, dotClass, toneClass } = classifyLiquidity(ratio);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
        toneClass
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClass, label === "critical" && "animate-pulse")} />
      Liquidity: {label}
    </span>
  );
}

function GrandTotalBlock({ grandTotal, liquidityRatio }: { grandTotal: number; liquidityRatio: number | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Total balance</p>
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={cn(
            "font-mono text-3xl max-sm:text-2xl font-semibold tabular-nums",
            grandTotal < 0 ? "text-destructive" : "text-foreground"
          )}
        >
          {formatCOP(grandTotal)}
        </p>
        <LiquidityPill ratio={liquidityRatio} />
      </div>
    </div>
  );
}

// ─── Account / wallet rows ──────────────────────────────────────────────────────

export function AccountLinkRow({
  account,
  wallet,
}: {
  account: AccountWithWallets;
  wallet: WalletBalance;
}) {
  return (
    <li>
      <Link
        href={walletHref(wallet.id)}
        className="group -ml-2 -mr-2 flex min-w-0 items-center justify-between gap-3 rounded-md py-2.5 pl-2 pr-2 transition-colors hover:bg-muted/20 focus-visible:bg-muted/20"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ColorDot color={account.color} />
          <span className="truncate text-sm text-foreground">{account.name}</span>
          {!account.includeInOverviewTotal && <ExcludedBadge />}
        </span>
        <BalanceText balance={wallet.balance} />
      </Link>
    </li>
  );
}

function ExcludedBadge() {
  return (
    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground shrink-0">
      hidden
    </span>
  );
}

function AccountSubtotalRow({ account }: { account: AccountWithWallets }) {
  return (
    <div className="-ml-2 -mr-2 flex min-w-0 items-center justify-between gap-3 py-2.5 pl-2 pr-2">
      <span className="flex min-w-0 items-center gap-2">
        <ColorDot color={account.color} />
        <span className="truncate text-sm font-medium text-foreground">{account.name}</span>
        {!account.includeInOverviewTotal && <ExcludedBadge />}
      </span>
      <BalanceText balance={account.balance} weight="semibold" />
    </div>
  );
}

export function WalletSubRow({ wallet }: { wallet: WalletBalance }) {
  return (
    <li>
      <Link
        href={walletHref(wallet.id)}
        className="group -mr-2 flex min-w-0 items-center justify-between gap-3 rounded-md py-2 pl-6 pr-2 transition-colors max-sm:pl-4 hover:bg-muted/20 focus-visible:bg-muted/20"
      >
        <span className="min-w-0 truncate text-sm text-foreground">{wallet.name}</span>
        <BalanceText balance={wallet.balance} />
      </Link>
    </li>
  );
}

export function AccountListItem({ account }: { account: AccountWithWallets }) {
  if (account.wallets.length === 1) {
    return <AccountLinkRow account={account} wallet={account.wallets[0]} />;
  }

  return (
    <li>
      <AccountSubtotalRow account={account} />
      <ul>
        {account.wallets.map((wallet) => (
          <WalletSubRow key={wallet.id} wallet={wallet} />
        ))}
      </ul>
    </li>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────────

export function AccountsEmptyState() {
  return (
    <div className="mt-4 rounded-md border border-dashed p-12 text-center text-muted-foreground">
      No accounts configured yet.
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────────

export async function AccountsCard() {
  const [{ accounts, grandTotal }, loans] = await Promise.all([
    getWalletBalances(),
    getLoansOverview(),
  ]);

  return (
    <Card className="border-border/60">
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Accounts
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4">
        <GrandTotalBlock grandTotal={grandTotal} liquidityRatio={loans.liquidityRatio} />
        {accounts.length === 0 ? (
          <AccountsEmptyState />
        ) : (
          <>
            <div className="mt-4 border-t border-border/60" />
            <ul className="divide-y divide-border/40">
              {accounts.map((account) => (
                <AccountListItem key={account.id} account={account} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
