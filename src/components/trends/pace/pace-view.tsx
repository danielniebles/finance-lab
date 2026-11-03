import { getSpendingPace } from "@/lib/queries/spending-pace";
import { splitCategoryChanges } from "@/lib/spending-pace-display";
import { CategoryChangesSection } from "./category-changes";
import { PaceHero } from "./pace-hero";

/** Trends › Pace: today's period against the same days of the previous one. */
export async function PaceView({ walletId, walletName }: { walletId?: string; walletName?: string }) {
  const pace = await getSpendingPace(walletId);
  if ("error" in pace) {
    return <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">{pace.error}</div>;
  }
  const changes = splitCategoryChanges(pace.categories, pace.unpaidBillCategories);
  const scope = { month: pace.current.month, year: pace.current.year, walletId };
  return (
    <div className="flex flex-col gap-6">
      <PaceHero pace={pace} walletName={walletName} />
      <CategoryChangesSection changes={changes} scope={scope} />
    </div>
  );
}
