import Link from "next/link";
import { EyeOff } from "lucide-react";
import { Money, SectionHeader } from "@/components/ds";
import type { AccountWithWallets, WalletBalance } from "@/lib/queries/wallets";
import { cn } from "@/lib/utils";

export function walletHref(walletId: string): string {
  return `/expenses?view=ledger&walletId=${encodeURIComponent(walletId)}`;
}

type WalletTile = {
  wallet: WalletBalance;
  account: AccountWithWallets;
  hidden: boolean;
};

/** One tile per wallet; accounts left out of the total come last. */
export function walletTiles(accounts: AccountWithWallets[]): WalletTile[] {
  const tiles = accounts.flatMap((account) =>
    account.wallets.map((wallet) => ({ wallet, account, hidden: !account.includeInOverviewTotal })),
  );
  return [...tiles.filter((t) => !t.hidden), ...tiles.filter((t) => t.hidden)];
}

export function WalletCard({ tile }: { tile: WalletTile }) {
  const { wallet, account, hidden } = tile;
  const multi = account.wallets.length > 1;
  return (
    <Link
      href={walletHref(wallet.id)}
      className={cn(
        "flex min-h-28 flex-col justify-between gap-4 rounded-xl border p-4 transition-colors",
        hidden
          ? "border-dashed border-border bg-background hover:bg-muted/30"
          : "border-border/60 bg-card hover:bg-muted/40",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            // Account colors are user data (picked per account), not theme colors.
            style={{ backgroundColor: account.color ?? "var(--muted-foreground)" }}
          />
          <span className="truncate">{account.name}</span>
        </span>
        {hidden && (
          <span className="shrink-0 text-muted-foreground" title="Not counted in the available balance">
            <EyeOff className="size-3.5" aria-hidden />
            <span className="sr-only">Not in total</span>
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1">
        <span className="truncate text-sm text-foreground">{multi ? wallet.name : account.name}</span>
        <Money
          value={wallet.balance}
          tone={wallet.balance < 0 ? "danger" : undefined}
          className={cn("text-lg font-semibold", hidden && "text-muted-foreground")}
        />
      </span>
    </Link>
  );
}

export function WalletsStrip({ accounts }: { accounts: AccountWithWallets[] }) {
  const tiles = walletTiles(accounts);
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Wallets" href="/loans" linkLabel="Manage" />
      {tiles.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No accounts configured yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {tiles.map((t) => (
            <WalletCard key={t.wallet.id} tile={t} />
          ))}
        </div>
      )}
    </section>
  );
}
