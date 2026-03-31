export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { MappingList } from "@/components/settings/mapping-list";

export default async function MappingsPage() {
  // "Salary" is income and never needs mapping — exclude it from the list
  const EXCLUDED_FROM_MAPPING = ["Salary"];

  const [mlCategories, appCategories] = await Promise.all([
    db.moneyLoverCategory.findMany({
      where: { name: { notIn: EXCLUDED_FROM_MAPPING } },
      orderBy: { name: "asc" },
      include: { mapping: { include: { appCategory: true } } },
    }),
    db.appCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Category Mappings</h1>
      <p className="text-sm text-muted-foreground">
        Map each MoneyLover category to one of your app categories. Unmapped categories are excluded from analysis.
      </p>
      {mlCategories.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No MoneyLover categories discovered yet. Import a file first.
        </div>
      ) : (
        <MappingList mlCategories={mlCategories} appCategories={appCategories} />
      )}
    </div>
  );
}
