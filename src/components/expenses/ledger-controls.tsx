"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LedgerGroupBy, LedgerFilters } from "@/lib/queries/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";

const GROUP_BY_OPTIONS: { value: LedgerGroupBy; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "category", label: "Category" },
  { value: "wallet", label: "Wallet" },
];

const ALL_SENTINEL = "all";

type FilterPatch = Partial<{
  groupBy: LedgerGroupBy;
  category: string;
  walletId: string;
  type: string;
  search: string;
}>;

// A patched field wins over the current value; falls back to "" (not
// undefined) so every filter field is uniformly a plain string the URLSearchParams
// step below can test for truthiness.
function resolvePatchedValue(patchValue: string | undefined, currentValue: string | undefined): string {
  return (patchValue !== undefined ? patchValue : currentValue) ?? "";
}

function resolveNextLedgerState(groupBy: LedgerGroupBy, filters: LedgerFilters, patch: FilterPatch) {
  return {
    groupBy: patch.groupBy ?? groupBy,
    category: resolvePatchedValue(patch.category, filters.category),
    walletId: resolvePatchedValue(patch.walletId, filters.walletId),
    type: resolvePatchedValue(patch.type, filters.type),
    search: resolvePatchedValue(patch.search, filters.search),
  };
}

// Every control on this bar (groupBy + all four filters) drives the SAME
// router.push mechanism PeriodSelector already established — one re-query
// path, not two. Pure so it's easy to reason about / test independent of the
// component.
export function buildLedgerUrl(
  month: number,
  year: number,
  groupBy: LedgerGroupBy,
  filters: LedgerFilters,
  patch: FilterPatch,
): string {
  const next = resolveNextLedgerState(groupBy, filters, patch);
  const params = new URLSearchParams({ view: "ledger", month: String(month), year: String(year) });
  if (next.groupBy !== "day") params.set("groupBy", next.groupBy);
  if (next.category) params.set("category", next.category);
  if (next.walletId) params.set("walletId", next.walletId);
  if (next.type) params.set("type", next.type);
  if (next.search) params.set("search", next.search);
  return `/expenses?${params.toString()}`;
}

type Props = {
  month: number;
  year: number;
  groupBy: LedgerGroupBy;
  filters: LedgerFilters;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  children: ReactNode;
};

export function LedgerControls({
  month,
  year,
  groupBy,
  filters,
  categories,
  walletOptions,
  children,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(patch: FilterPatch) {
    const url = buildLedgerUrl(month, year, groupBy, filters, patch);
    startTransition(() => router.push(url));
  }

  return (
    <div className="space-y-3">
      <GroupByToggle value={groupBy} onChange={(v) => navigate({ groupBy: v })} />
      <FilterBar
        filters={filters}
        categories={categories}
        walletOptions={walletOptions}
        onChange={navigate}
      />
      {/* Whole-region dim during re-query — no spinner, no skeleton (matches
          category-breakdown-table.tsx's restraint). */}
      <div className={cn("transition-opacity", isPending && "opacity-50 pointer-events-none")}>
        {children}
      </div>
    </div>
  );
}

function GroupByToggle({
  value,
  onChange,
}: {
  value: LedgerGroupBy;
  onChange: (v: LedgerGroupBy) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {GROUP_BY_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Button
            key={opt.value}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(active && "bg-muted text-primary hover:bg-muted hover:text-primary")}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

function FilterBar({
  filters,
  categories,
  walletOptions,
  onChange,
}: {
  filters: LedgerFilters;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  onChange: (patch: FilterPatch) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CategorySelect
        value={filters.category}
        categories={categories}
        onChange={(v) => onChange({ category: v ?? "" })}
      />
      <WalletSelect
        value={filters.walletId}
        options={walletOptions}
        onChange={(v) => onChange({ walletId: v ?? "" })}
      />
      <TypeSelect
        value={filters.type}
        onChange={(v) => onChange({ type: v ?? "" })}
      />
      <SearchInput
        value={filters.search}
        onChange={(v) => onChange({ search: v ?? "" })}
      />
    </div>
  );
}

function CategorySelect({
  value,
  categories,
  onChange,
}: {
  value?: string;
  categories: CategoryOption[];
  onChange: (v?: string) => void;
}) {
  return (
    <Select
      value={value ?? ALL_SENTINEL}
      onValueChange={(v) => v && onChange(v === ALL_SENTINEL ? undefined : v)}
    >
      <SelectTrigger className="h-8 w-36" aria-label="Filter by category">
        <span className="text-sm truncate">{value ?? "All categories"}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SENTINEL}>All categories</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.name}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WalletSelect({
  value,
  options,
  onChange,
}: {
  value?: string;
  options: { id: string; name: string }[];
  onChange: (v?: string) => void;
}) {
  const current = options.find((w) => w.id === value);
  return (
    <Select
      value={value ?? ALL_SENTINEL}
      onValueChange={(v) => v && onChange(v === ALL_SENTINEL ? undefined : v)}
    >
      <SelectTrigger className="h-8 w-32" aria-label="Filter by wallet">
        <span className="text-sm truncate">{current?.name ?? "All wallets"}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SENTINEL}>All wallets</SelectItem>
        {options.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const TYPE_LABELS: Record<"all" | "expense" | "income", string> = {
  all: "All",
  expense: "Expense",
  income: "Income",
};

function TypeSelect({
  value,
  onChange,
}: {
  value?: "expense" | "income";
  onChange: (v?: "expense" | "income") => void;
}) {
  const current = value ?? "all";
  return (
    <Select
      value={current}
      onValueChange={(v) => v && onChange(v === "all" ? undefined : (v as "expense" | "income"))}
    >
      <SelectTrigger className="h-8 w-24" aria-label="Filter by type">
        <span className="text-sm">{TYPE_LABELS[current]}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="expense">Expense</SelectItem>
        <SelectItem value="income">Income</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Only control on this bar that doesn't fire immediately — debounced ~300ms
// so the ledger doesn't re-query on every keystroke. Tracks the last value it
// itself emitted so an EXTERNAL change (e.g. the "Clear filters" action, or
// browser back/forward) correctly resets the local draft, without the
// debounce echoing its own emission back into a reset.
function SearchInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v?: string) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const [prevValue, setPrevValue] = useState(value ?? "");
  // What THIS component itself last pushed upstream. Plain state, not a ref —
  // the render-time reset below needs to read it, and refs can't be read
  // during render (react-hooks/refs).
  const [lastEmitted, setLastEmitted] = useState(value ?? "");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Reset the local draft only when an EXTERNAL value change arrives (e.g.
  // "Clear filters", browser back/forward) — adjusted during render (React's
  // documented "adjusting state when a prop changes" pattern) rather than
  // inside an effect, since setState synchronously inside an effect body
  // triggers an avoidable extra render-then-commit cascade. Guarded by
  // lastEmitted so the debounce's own emission — echoed back down once the
  // URL/props update — doesn't stomp a newer local edit made in the meantime.
  if ((value ?? "") !== prevValue) {
    setPrevValue(value ?? "");
    if ((value ?? "") !== lastEmitted) {
      setLastEmitted(value ?? "");
      setText(value ?? "");
    }
  }

  useEffect(() => {
    const id = setTimeout(() => {
      if (text !== lastEmitted) {
        setLastEmitted(text);
        onChangeRef.current(text || undefined);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [text, lastEmitted]);

  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Buscar por nota…"
      aria-label="Buscar por nota"
      className="h-8 w-48"
    />
  );
}
