"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Money } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExpensesSearchParams } from "@/lib/build-expenses-url";
import type { WalletChipOption } from "@/lib/expenses-ledger-display";
import { WalletQuickFilter } from "@/components/expenses/wallet-quick-filter";

/** Fired by the bar's search button; the ledger toolbar opens and focuses its search. */
export const OPEN_LEDGER_SEARCH = "ledger:open-search";

type Props = {
  summaryId: string;
  month: number;
  year: number;
  expenses: number;
  net: number;
  balance: number;
  wallets: WalletChipOption[];
  walletActivity: Record<string, number>;
  selectedWalletId: string | undefined;
  currentParams: ExpensesSearchParams;
};

/** True once the element with this id has scrolled out above the viewport. */
function useScrolledPast(id: string): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [id]);
  return past;
}

function monthLabel(month: number, year: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

/**
 * Phones only: once the summary card scrolls away, a bar slides in at the
 * top with the wallet chips (the same WalletQuickFilter, compact) and a
 * one-line summary that scrolls back to the card.
 */
export function LedgerStickyBar({
  summaryId,
  month,
  year,
  expenses,
  net,
  balance,
  wallets,
  walletActivity,
  selectedWalletId,
  currentParams,
}: Props) {
  const shown = useScrolledPast(summaryId);

  function backToSummary() {
    document.getElementById(summaryId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      aria-hidden={!shown}
      inert={!shown}
      className={cn(
        "fixed inset-x-0 top-0 z-30 flex flex-col gap-2 border-b border-border/60 bg-background/95 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur transition-transform duration-200 sm:hidden",
        !shown && "-translate-y-full",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-sm font-semibold">
          Expenses · <span className="text-muted-foreground">{monthLabel(month, year)}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Search transactions"
          onClick={() => window.dispatchEvent(new Event(OPEN_LEDGER_SEARCH))}
        >
          <Search aria-hidden />
        </Button>
      </div>
      <WalletQuickFilter
        compact
        wallets={wallets}
        activity={walletActivity}
        selectedId={selectedWalletId}
        month={month}
        year={year}
        currentParams={currentParams}
        className="-mx-4 px-4"
      />
      <button
        type="button"
        onClick={backToSummary}
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span>
          Spent <Money value={expenses} compact className="text-foreground" />
        </span>
        <span aria-hidden>·</span>
        <span>
          Net <Money value={net} compact signed className="text-foreground" />
        </span>
        <span aria-hidden>·</span>
        <span>
          Bal <Money value={balance} compact className="text-foreground" />
        </span>
        <ChevronDown className="ml-auto size-3.5" aria-hidden />
      </button>
    </div>
  );
}
