"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorDot, Money, StatusChip } from "@/components/ds";
import { toneForWalletRole } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  accountSubtitle,
  walletRoleChips,
  type WalletSettingsAccount,
  type WalletSettingsRow,
} from "@/lib/wallet-settings-display";
import { WalletDialog } from "./wallet-dialog";

function WalletRow({ account, wallet, muted }: { account: WalletSettingsAccount; wallet: WalletSettingsRow; muted: boolean }) {
  const [open, setOpen] = useState(false);
  const chips = walletRoleChips(wallet, account.wallets.length);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5 text-left transition-colors hover:bg-muted/20 sm:px-5"
      >
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className={cn("flex min-w-0 items-center gap-2 text-sm font-medium", muted && "text-muted-foreground")}>
            <ColorDot color={wallet.color ?? account.color} />
            <span className="truncate">{wallet.name}</span>
          </span>
          {chips.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c.role} title={c.title}>
                  <StatusChip tone={toneForWalletRole(c.role)}>{c.label}</StatusChip>
                </span>
              ))}
            </span>
          )}
        </span>
        <Money
          value={wallet.balance}
          tone={wallet.balance < 0 ? "danger" : undefined}
          className={cn("text-sm font-semibold", muted && "text-muted-foreground")}
        />
      </button>
      <WalletDialog account={account} wallet={wallet} open={open} onClose={() => setOpen(false)} />
    </li>
  );
}

function AccountSection({ account }: { account: WalletSettingsAccount }) {
  const [adding, setAdding] = useState(false);
  const muted = !account.includeInOverviewTotal;
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className={cn("flex min-w-0 items-center gap-2 text-base font-semibold", muted && "text-muted-foreground")}>
          <ColorDot color={account.color} className="size-2.5" />
          <span className="truncate">{account.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{accountSubtitle(account)}</span>
        </h2>
        <span className="flex items-center gap-3">
          <Money value={account.balance} className={cn("text-sm font-semibold", muted && "text-muted-foreground")} />
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Add wallet
          </Button>
        </span>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border",
          muted ? "border-dashed border-border bg-background" : "border-border/60 bg-card",
        )}
      >
        <ul className="divide-y divide-border/40">
          {account.wallets.map((w) => (
            <WalletRow key={w.id} account={account} wallet={w} muted={muted} />
          ))}
        </ul>
      </div>
      <WalletDialog account={account} open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}

/** Accounts counted in the Home total first, then the excluded ones. */
export function WalletList({ accounts }: { accounts: WalletSettingsAccount[] }) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No accounts yet. Add one on Savings &amp; Loans.
      </p>
    );
  }
  const ordered = [...accounts.filter((a) => a.includeInOverviewTotal), ...accounts.filter((a) => !a.includeInOverviewTotal)];
  return (
    <div className="flex flex-col gap-7">
      {ordered.map((a) => (
        <AccountSection key={a.id} account={a} />
      ))}
      <p className="text-xs text-muted-foreground">
        Tap a wallet to edit it. Account name, type and colour stay on Savings &amp; Loans.
      </p>
    </div>
  );
}
