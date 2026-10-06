"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money, SegmentedControl, StatusChip } from "@/components/ds";
import { resolveEffectiveCategoryStyle } from "@/lib/category-style";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";
import { BudgetItemDialog } from "./categories/budget-item-dialog";
import { CategoryDialog } from "./categories/category-dialog";
import { CategoryStyleDialog } from "./categories/category-style-dialog";
import type { BudgetItemData, SettingsCategory } from "./categories/types";

type EffectiveType = "FIXED" | "VARIABLE" | "MIXED";

function getEffectiveType(items: BudgetItemData[]): EffectiveType {
  if (items.length === 0) return "VARIABLE";
  const hasFixed = items.some((i) => i.budgetType === "FIXED");
  const hasVariable = items.some((i) => i.budgetType === "VARIABLE");
  if (hasFixed && hasVariable) return "MIXED";
  return hasFixed ? "FIXED" : "VARIABLE";
}

const TYPE_CHIP: Record<EffectiveType, { tone: Tone; label: string }> = {
  FIXED: { tone: "info", label: "Fixed" },
  VARIABLE: { tone: "neutral", label: "Variable" },
  // Neutral: a category with both kinds of items isn't a warning.
  MIXED: { tone: "neutral", label: "Mixed" },
};

function TypeChip({ type }: { type: EffectiveType }) {
  return <StatusChip tone={TYPE_CHIP[type].tone}>{TYPE_CHIP[type].label}</StatusChip>;
}

const total = (items: BudgetItemData[]) => items.reduce((s, i) => s + i.amount, 0);

// Opens the icon & colour dialog. Shows the category's effective style, the
// same tile its transactions get on the ledger.
function CategorySwatchButton({ cat, onClick }: { cat: SettingsCategory; onClick: () => void }) {
  const { icon: CategoryIcon, iconWrap } = resolveEffectiveCategoryStyle(cat.name, cat.icon, cat.color);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`Customize icon and color for ${cat.name}`}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:ring-2 hover:ring-ring/40",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        iconWrap,
      )}
    >
      <CategoryIcon className="size-5" />
    </button>
  );
}

// One markup for phone and desktop: chevron | swatch + name (+ meta line on
// phones) | type | amount. Tapping the name opens the edit dialog.
const ROW_GRID = "grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 px-3 py-2.5 sm:grid-cols-[2rem_1fr_6rem_9rem] sm:px-4";

function BudgetItemRow({ item, onOpen }: { item: BudgetItemData; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={cn(ROW_GRID, "w-full text-left transition-colors hover:bg-muted/40")}>
        <span />
        <span className="flex min-w-0 flex-col pl-3 sm:pl-12">
          <span className="truncate text-sm">{item.name}</span>
          <span className="text-xs text-muted-foreground sm:hidden">{TYPE_CHIP[item.budgetType].label}</span>
        </span>
        <span className="hidden sm:block">
          <TypeChip type={item.budgetType} />
        </span>
        <Money value={item.amount} className="text-right text-sm text-muted-foreground" />
      </button>
    </li>
  );
}

function BudgetPanel({ cat }: { cat: SettingsCategory }) {
  const [dialog, setDialog] = useState<{ item?: BudgetItemData } | null>(null);
  return (
    <div className="border-t border-border/40 bg-muted/20">
      {cat.budgetItems.length === 0 ? (
        <p className="py-2.5 pr-4 pl-[3.5rem] text-xs text-muted-foreground sm:pl-[7.25rem]">No budget items yet.</p>
      ) : (
        <ul className="divide-y divide-border/30">
          {cat.budgetItems.map((item) => (
            <BudgetItemRow key={item.id} item={item} onOpen={() => setDialog({ item })} />
          ))}
        </ul>
      )}
      <div className="py-1.5 pl-[3rem] sm:pl-[6.75rem]">
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={() => setDialog({})}>
          <Plus className="size-3.5" />
          Add item
        </Button>
      </div>
      <BudgetItemDialog
        categoryId={cat.id}
        categoryName={cat.name}
        item={dialog?.item}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function CategoryRow({ cat }: { cat: SettingsCategory }) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const type = getEffectiveType(cat.budgetItems);
  const n = cat.budgetItems.length;

  return (
    <li>
      <div className={cn(ROW_GRID, "transition-colors hover:bg-muted/20")}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} budget items for ${cat.name}`}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </button>
        <span className="flex min-w-0 items-center gap-3">
          <CategorySwatchButton cat={cat} onClick={() => setStyleOpen(true)} />
          <button type="button" onClick={() => setEditOpen(true)} className="flex min-w-0 flex-col text-left">
            <span className="truncate font-medium">{cat.name}</span>
            <span className="text-xs text-muted-foreground">
              {n} {n === 1 ? "item" : "items"}
              <span className="sm:hidden"> · {TYPE_CHIP[type].label}</span>
            </span>
          </button>
        </span>
        <span className="hidden sm:block">
          <TypeChip type={type} />
        </span>
        <span className="text-right text-sm">
          <Money value={total(cat.budgetItems)} compact className="sm:hidden" />
          <Money value={total(cat.budgetItems)} className="max-sm:hidden" />
        </span>
      </div>
      {expanded && <BudgetPanel cat={cat} />}
      <CategoryDialog cat={cat} open={editOpen} onClose={() => setEditOpen(false)} />
      <CategoryStyleDialog cat={cat} open={styleOpen} onClose={() => setStyleOpen(false)} />
    </li>
  );
}

type FilterType = "ALL" | EffectiveType;
type SortBy = "name" | "amount" | "type";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "FIXED", label: "Fixed" },
  { value: "VARIABLE", label: "Variable" },
  { value: "MIXED", label: "Mixed" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "amount", label: "Amount" },
  { value: "type", label: "Type" },
];

const TYPE_ORDER: Record<EffectiveType, number> = { FIXED: 0, MIXED: 1, VARIABLE: 2 };

function visibleCategories(categories: SettingsCategory[], filter: FilterType, sortBy: SortBy): SettingsCategory[] {
  const filtered = filter === "ALL" ? categories : categories.filter((c) => getEffectiveType(c.budgetItems) === filter);
  return [...filtered].sort((a, b) => {
    if (sortBy === "amount") return total(b.budgetItems) - total(a.budgetItems);
    if (sortBy === "type") return TYPE_ORDER[getEffectiveType(a.budgetItems)] - TYPE_ORDER[getEffectiveType(b.budgetItems)];
    return a.name.localeCompare(b.name);
  });
}

function Totals({ categories }: { categories: SettingsCategory[] }) {
  const sumOf = (type: "FIXED" | "VARIABLE") =>
    categories.reduce((s, c) => s + total(c.budgetItems.filter((i) => i.budgetType === type)), 0);
  const fixed = sumOf("FIXED");
  const variable = sumOf("VARIABLE");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/60 px-4 py-2.5 text-sm">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">Totals</span>
      <span className="flex items-center gap-1.5">
        <TypeChip type="FIXED" />
        <Money value={fixed} />
      </span>
      <span className="flex items-center gap-1.5">
        <TypeChip type="VARIABLE" />
        <Money value={variable} />
      </span>
      <span className="font-medium sm:ml-auto">
        <Money value={fixed + variable} /> / mo
      </span>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <li className="px-4 py-6 text-center text-sm text-muted-foreground">{children}</li>;
}

export function CategoryList({ categories }: { categories: SettingsCategory[] }) {
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const sorted = visibleCategories(categories, filter, sortBy);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl ariaLabel="Filter by type" size="sm" value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
        <SegmentedControl ariaLabel="Sort by" size="sm" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className={cn(ROW_GRID, "hidden border-b border-border/60 py-2 text-xs tracking-wide text-muted-foreground uppercase sm:grid")}>
          <span />
          <span>Category</span>
          <span>Type</span>
          <span className="text-right">Budget / mo</span>
        </div>
        <ul className="divide-y divide-border/40">
          {sorted.map((cat) => (
            <CategoryRow key={cat.id} cat={cat} />
          ))}
          {categories.length === 0 && <EmptyRow>No categories yet.</EmptyRow>}
          {categories.length > 0 && sorted.length === 0 && (
            <EmptyRow>No {FILTER_OPTIONS.find((o) => o.value === filter)?.label.toLowerCase()} categories.</EmptyRow>
          )}
        </ul>
      </div>

      {categories.length > 0 && <Totals categories={categories} />}

    </div>
  );
}
