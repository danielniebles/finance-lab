import Link from "next/link";
import { Money, SectionHeader, StatusChip } from "@/components/ds";
import { PayBills } from "@/components/bills/pay-bills";
import type { WalletOption } from "@/components/shared/wallet-select";
import type { HomeInsight } from "@/lib/home-insights";
import type { BillsForMonth } from "@/lib/queries/bills";

function chipLabel(i: HomeInsight): string {
  if (i.tone === "unplanned") return "No budget";
  if (i.tone === "info") return "Pending";
  return "Over budget";
}

function action(i: HomeInsight): { href: string; label: string } | null {
  if (i.tone === "unplanned") return { href: "/settings/categories", label: "Set a budget →" };
  return i.category
    ? { href: `/expenses?view=ledger&category=${encodeURIComponent(i.category)}`, label: "See transactions →" }
    : null;
}

// "Needs attention" — replaces "Top Issues". Same rules as the Home insights
// (lib/home-insights): unplanned spend, over budget, bills not paid yet (opens Pay bills).
export function AttentionCards({
  insights,
  payBills,
}: {
  insights: HomeInsight[];
  payBills: { bills: BillsForMonth; walletOptions: WalletOption[] };
}) {
  if (insights.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Needs attention" />
      <div className="grid gap-3 md:grid-cols-3">
        {insights.map((i) => {
          const a = action(i);
          return (
            <div key={i.key} className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{i.title}</span>
                <StatusChip tone={i.tone}>{chipLabel(i)}</StatusChip>
              </div>
              <Money value={i.amount} className="text-xl font-semibold" />
              <span className="text-xs text-muted-foreground">{i.detail}</span>
              {i.action === "pay-bills" && (
                <PayBills
                  data={payBills.bills}
                  walletOptions={payBills.walletOptions}
                  className="mt-auto self-start text-xs font-semibold text-primary hover:underline"
                >
                  Pay bills →
                </PayBills>
              )}
              {a && (
                <Link href={a.href} className="mt-auto text-xs font-semibold text-primary hover:underline">
                  {a.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
