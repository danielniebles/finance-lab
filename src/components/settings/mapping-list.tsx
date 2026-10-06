"use client";

import { useTransition } from "react";
import { OptionSelect, SectionHeader } from "@/components/ds";
import { categorySelectOptions } from "@/components/shared/category-option";
import { saveCategoryMapping, deleteCategoryMapping } from "@/lib/actions/categories";

type MLCategory = {
  id: string;
  name: string;
  mapping: { appCategory: { id: string; name: string } } | null;
};

type AppCategory = { id: string; name: string; icon?: string | null; color?: string | null };

/**
 * Legacy MoneyLover → app category mappings. Each row is a dropdown; "Not
 * mapped" removes the mapping (those imported transactions drop out of the
 * analysis), so there's no separate one-tap unmap button any more.
 */
export function MappingList({
  mlCategories,
  appCategories,
}: {
  mlCategories: MLCategory[];
  appCategories: AppCategory[];
}) {
  const [isPending, startTransition] = useTransition();
  const options = categorySelectOptions(appCategories);
  const unmapped = mlCategories.filter((c) => !c.mapping);
  const mapped = mlCategories.filter((c) => c.mapping);

  function change(cat: MLCategory, appCategoryId: string | null) {
    startTransition(async () => {
      if (appCategoryId) await saveCategoryMapping(cat.id, appCategoryId);
      else await deleteCategoryMapping(cat.id);
    });
  }

  const group = (title: string, cats: MLCategory[], trailing?: React.ReactNode) =>
    cats.length > 0 && (
      <section className="flex flex-col gap-3">
        <SectionHeader title={title} trailing={trailing} />
        <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card">
          {cats.map((cat) => (
            <li key={cat.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4">
              <span className="truncate text-sm font-medium">{cat.name}</span>
              <OptionSelect
                ariaLabel={`App category for ${cat.name}`}
                value={cat.mapping?.appCategory.id ?? null}
                onChange={(v) => change(cat, v)}
                noneLabel="Not mapped"
                options={options}
                disabled={isPending}
              />
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="flex flex-col gap-8">
      {group(
        "Not mapped",
        unmapped,
        <span className="text-xs text-muted-foreground">Their imported transactions are left out of the analysis.</span>,
      )}
      {group("Mapped", mapped)}
    </div>
  );
}
