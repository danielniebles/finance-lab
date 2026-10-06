export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ds";
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
    db.appCategory.findMany({ where: { isTransfer: false }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Legacy mappings"
        description="How old MoneyLover imports map to your categories. Import is retired; keep these so that history stays categorised."
      />
      {mlCategories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No imported MoneyLover categories.
        </p>
      ) : (
        <MappingList mlCategories={mlCategories} appCategories={appCategories} />
      )}
    </div>
  );
}
