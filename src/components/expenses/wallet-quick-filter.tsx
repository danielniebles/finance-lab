"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ColorDot } from "@/components/ds";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buildExpensesUrl, type ExpensesSearchParams } from "@/lib/build-expenses-url";
import {
  ALL_WALLETS,
  LEDGER_WALLET_COOKIE,
  walletChips,
  type WalletChipOption,
} from "@/lib/expenses-ledger-display";

type Props = {
  wallets: WalletChipOption[];
  activity: Record<string, number>;
  selectedId: string | undefined;
  month: number;
  year: number;
  currentParams: ExpensesSearchParams;
  /** 36px chips for the phone's collapsed sticky bar; default is 44px / 40px from sm. */
  compact?: boolean;
  className?: string;
};

const CHIP =
  "flex shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors";
const CHIP_OFF = "border-border/60 bg-background hover:bg-muted/50";
const CHIP_ON = "border-primary bg-primary/10 font-semibold";

/**
 * Remembers the ledger's wallet (last chip picked, or the wallet an Overview
 * card linked to) so /expenses opens on it next time. Render once per page.
 */
export function RememberLedgerWallet({ walletId }: { walletId: string | undefined }) {
  useEffect(() => {
    document.cookie = `${LEDGER_WALLET_COOKIE}=${walletId ?? ALL_WALLETS};path=/;max-age=31536000;SameSite=Lax`;
  }, [walletId]);
  return null;
}

/**
 * All wallets · one chip per wallet · "N more". Scopes everything under it
 * (summary, category chips, list). The selected wallet is always a chip
 * (walletChips); "All wallets" is sent as an explicit `walletId=all` so the
 * remembered wallet doesn't override it.
 */
export function WalletQuickFilter({
  wallets,
  activity,
  selectedId,
  month,
  year,
  currentParams,
  compact = false,
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { visible, more } = walletChips(wallets, activity, selectedId);
  const size = compact ? "h-9" : "h-11 sm:h-10";

  function select(walletId: string | undefined) {
    if (walletId === selectedId) return;
    const url = buildExpensesUrl(currentParams, {
      month: String(month),
      year: String(year),
      walletId: walletId ?? ALL_WALLETS,
      groupBy: undefined,
    });
    startTransition(() => router.push(url));
  }

  return (
    <div
      role="group"
      aria-label="Wallet"
      className={cn(
        "no-scrollbar flex items-center gap-2 overflow-x-auto transition-opacity",
        isPending && "pointer-events-none opacity-60",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={!selectedId}
        onClick={() => select(undefined)}
        className={cn(CHIP, size, !selectedId ? CHIP_ON : CHIP_OFF)}
      >
        All wallets
      </button>
      {visible.map((wallet) => (
        <button
          key={wallet.id}
          type="button"
          aria-pressed={wallet.id === selectedId}
          onClick={() => select(wallet.id)}
          className={cn(CHIP, size, wallet.id === selectedId ? CHIP_ON : CHIP_OFF)}
        >
          <ColorDot color={wallet.color} />
          {wallet.name}
        </button>
      ))}
      {more.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(CHIP, size, CHIP_OFF, "text-muted-foreground")}>
            {more.length} more
            <ChevronDown className="size-3.5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {more.map((wallet) => (
              <DropdownMenuItem key={wallet.id} onClick={() => select(wallet.id)}>
                <ColorDot color={wallet.color} />
                {wallet.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
