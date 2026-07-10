import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";
import { getWalletBalances } from "@/lib/queries/wallets";
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

function RowChevron() {
  return (
    <ArrowRight
      aria-hidden="true"
      className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60 group-focus-visible:text-muted-foreground/60"
    />
  );
}

// ─── Grand total ────────────────────────────────────────────────────────────────

function GrandTotalBlock({ grandTotal }: { grandTotal: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Total balance</p>
      <p
        className={cn(
          "font-mono text-3xl max-sm:text-2xl font-semibold tabular-nums",
          grandTotal < 0 ? "text-destructive" : "text-foreground"
        )}
      >
        {formatCOP(grandTotal)}
      </p>
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
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <BalanceText balance={wallet.balance} />
          <RowChevron />
        </span>
      </Link>
    </li>
  );
}

function AccountSubtotalRow({ account }: { account: AccountWithWallets }) {
  return (
    <div className="-ml-2 -mr-2 flex min-w-0 items-center justify-between gap-3 py-2.5 pl-2 pr-2">
      <span className="flex min-w-0 items-center gap-2">
        <ColorDot color={account.color} />
        <span className="truncate text-sm font-medium text-foreground">{account.name}</span>
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
        <span className="flex shrink-0 items-center gap-1.5">
          <BalanceText balance={wallet.balance} />
          <RowChevron />
        </span>
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
  const { accounts, grandTotal } = await getWalletBalances();

  return (
    <Card className="border-border/60">
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Accounts
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4">
        <GrandTotalBlock grandTotal={grandTotal} />
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
