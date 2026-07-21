"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildExpensesUrl, type ExpensesSearchParams } from "@/lib/build-expenses-url";

type View = "analysis" | "ledger";

type Props = {
  view: View;
  month: number;
  year: number;
  currentParams: ExpensesSearchParams;
};

// Small tab pair on the existing expenses/page.tsx (?view=analysis|ledger), not
// a new route or a shadcn Tabs primitive — see the design spec's "Analysis/Ledger
// tab styling" open question for why promoting to a real Tabs component is
// deliberately out of scope here.
export function ViewTabs({ view, month, year, currentParams }: Props) {
  const router = useRouter();

  // Preserve every other param (walletId, groupBy, category, type, search) —
  // switching tabs should never drop the current filter.
  function navigate(next: View) {
    router.push(
      buildExpensesUrl(currentParams, { month: String(month), year: String(year), view: next }),
    );
  }

  return (
    <div role="tablist" aria-label="Expenses view" className="flex w-full items-center gap-1 sm:w-auto">
      <ViewTab label="Analysis" active={view === "analysis"} onClick={() => navigate("analysis")} />
      <ViewTab label="Ledger" active={view === "ledger"} onClick={() => navigate("ledger")} />
    </div>
  );
}

function ViewTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-8 flex-1 rounded-lg px-3 text-center text-sm font-medium transition-colors sm:flex-none",
        active
          ? "bg-muted text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
