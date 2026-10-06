import { resolveEffectiveCategoryStyle } from "@/lib/category-style";
import type { SelectOption } from "@/components/ds";
import { cn } from "@/lib/utils";

type CategoryLike = { id: string; name: string; icon?: string | null; color?: string | null };

/** The category's icon tile (same icon and hue as the ledger rows). */
export function CategoryIconTile({ category, className }: { category: Omit<CategoryLike, "id">; className?: string }) {
  const { icon: Icon, iconWrap } = resolveEffectiveCategoryStyle(category.name, category.icon ?? null, category.color ?? null);
  return (
    <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-md", iconWrap, className)}>
      <Icon className="size-3" />
    </span>
  );
}

/** Categories as OptionSelect options, each with its icon tile. */
export function categorySelectOptions(categories: CategoryLike[]): SelectOption[] {
  return categories.map((c) => ({ value: c.id, label: c.name, leading: <CategoryIconTile category={c} /> }));
}
