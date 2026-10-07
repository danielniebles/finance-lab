"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormDialog, FormFooter, Money, OptionSelect, SegmentedControl, type SegmentOption } from "@/components/ds";
import { cn } from "@/lib/utils";
import { OPEN_LEDGER_SEARCH } from "@/components/expenses/ledger-sticky-bar";
import {
  ALL_WALLETS,
  activeFilters,
  moreFiltersCount,
  transactionCountLabel,
} from "@/lib/expenses-ledger-display";
import type { LedgerFilters, LedgerGroup } from "@/lib/queries/transactions";
import type { TagOption } from "@/lib/queries/tags";

type FilterPatch = Partial<{
  category: string;
  walletId: string;
  type: string;
  search: string;
  tagId: string;
}>;

// A patched field wins over the current value; falls back to "" (not
// undefined) so every filter field is uniformly a plain string the URLSearchParams
// step below can test for truthiness.
function resolvePatchedValue(patchValue: string | undefined, currentValue: string | undefined): string {
  return (patchValue !== undefined ? patchValue : currentValue) ?? "";
}

// Every control on the Ledger (wallet and category chips, search, More
// filters, the active-filters line) drives the SAME router.push mechanism
// PeriodSelector already established — one re-query path, not two. The
// ledger always groups by day, so groupBy is never written. The wallet is
// always explicit (`all` when none) so the remembered wallet cookie never
// overrides what's on screen. Pure so it's easy to test.
export function buildLedgerUrl(month: number, year: number, filters: LedgerFilters, patch: FilterPatch): string {
  const params = new URLSearchParams({ view: "ledger", month: String(month), year: String(year) });
  params.set("walletId", resolvePatchedValue(patch.walletId, filters.walletId) || ALL_WALLETS);
  for (const key of ["category", "type", "search", "tagId"] as const) {
    const value = resolvePatchedValue(patch[key], filters[key]);
    if (value) params.set(key, value);
  }
  return `/expenses?${params.toString()}`;
}

const CLEAR_ALL: FilterPatch = { category: "", type: "", search: "", tagId: "" };

type Props = {
  month: number;
  year: number;
  filters: LedgerFilters;
  tags: TagOption[];
  groups: LedgerGroup[];
  /** Transactions in the wallet scope before the other filters ("of N"). */
  scopeCount: number;
  /** A category, type, tag or search narrows the list. */
  filtered: boolean;
  children: ReactNode;
};

export function LedgerControls({ month, year, filters, tags, groups, scopeCount, filtered, children }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const items = groups.flatMap((g) => g.items);

  function navigate(patch: FilterPatch) {
    const url = buildLedgerUrl(month, year, filters, patch);
    startTransition(() => router.push(url));
  }

  return (
    <div className="space-y-3">
      <LedgerToolbar
        count={transactionCountLabel(items.length, scopeCount, filtered)}
        filters={filters}
        tags={tags}
        onChange={navigate}
      />
      <ActiveFiltersLine filters={filters} tags={tags} onChange={navigate} />
      {/* Whole-region dim during re-query — no spinner, no skeleton (matches
          category-breakdown-table.tsx's restraint). */}
      <div className={cn("space-y-3 transition-opacity", isPending && "opacity-50 pointer-events-none")}>
        {children}
        {filtered && items.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {items.length} transaction{items.length === 1 ? "" : "s"} ·{" "}
            <Money value={items.reduce((sum, item) => sum + item.amount, 0)} signed className="text-foreground" />
          </p>
        )}
      </div>
    </div>
  );
}

// "Transactions · 2 of 17" · search · More filters. On phones the search is
// an icon button that opens the input on its own row.
function LedgerToolbar({
  count,
  filters,
  tags,
  onChange,
}: {
  count: string;
  filters: LedgerFilters;
  tags: TagOption[];
  onChange: (patch: FilterPatch) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(Boolean(filters.search));
  const searchRef = useRef<HTMLInputElement>(null);

  // The phone's collapsed sticky bar asks for the search: open it, bring it
  // into view and focus it.
  useEffect(() => {
    function openSearch() {
      setSearchOpen(true);
      requestAnimationFrame(() => {
        searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        searchRef.current?.focus({ preventScroll: true });
      });
    }
    window.addEventListener(OPEN_LEDGER_SEARCH, openSearch);
    return () => window.removeEventListener(OPEN_LEDGER_SEARCH, openSearch);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Transactions · {count}
      </h2>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="sm:hidden"
        aria-label="Search"
        aria-expanded={searchOpen}
        onClick={() => setSearchOpen((open) => !open)}
      >
        <Search aria-hidden />
      </Button>
      <MoreFilters filters={filters} tags={tags} onChange={onChange} />
      <SearchInput
        value={filters.search}
        onChange={(v) => onChange({ search: v ?? "" })}
        inputRef={searchRef}
        autoFocus={searchOpen && !filters.search}
        className={cn("h-9 max-sm:order-last max-sm:h-10 max-sm:w-full sm:w-56", !searchOpen && "max-sm:hidden")}
      />
    </div>
  );
}

// "Showing [Supermarket ×] [Expenses only ×] [#meat ×] · Clear all". The
// wallet isn't listed (its chip row shows it) and Clear all keeps it.
function ActiveFiltersLine({
  filters,
  tags,
  onChange,
}: {
  filters: LedgerFilters;
  tags: TagOption[];
  onChange: (patch: FilterPatch) => void;
}) {
  const list = activeFilters(filters, tags);
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Showing</span>
      {list.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onChange({ [filter.key]: "" })}
          aria-label={`Remove filter ${filter.label}`}
          className="flex h-7 items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 font-medium text-foreground"
        >
          {filter.label}
          <X className="size-3" aria-hidden />
        </button>
      ))}
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={() => onChange(CLEAR_ALL)}
        className="font-medium underline-offset-4 hover:text-foreground hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

type TypeValue = "all" | "expense" | "income";

const TYPE_OPTIONS: SegmentOption<TypeValue>[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
];

// The less-used filters (type, tag) behind one button that shows how many
// are on. FormDialog: a centred dialog from sm, a bottom sheet on phones.
function MoreFilters({
  filters,
  tags,
  onChange,
}: {
  filters: LedgerFilters;
  tags: TagOption[];
  onChange: (patch: FilterPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TypeValue>("all");
  const [tagId, setTagId] = useState<string | null>(null);
  const count = moreFiltersCount(filters);

  function openSheet() {
    setType(filters.type ?? "all");
    setTagId(filters.tagId ?? null);
    setOpen(true);
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    onChange({ type: type === "all" ? "" : type, tagId: tagId ?? "" });
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={openSheet}
        className={cn(count > 0 && "border-primary bg-primary/10 font-semibold")}
      >
        <SlidersHorizontal aria-hidden />
        {/* "More" drops on phones so the toolbar stays on one line. */}
        <span className="max-sm:hidden">More filters</span>
        <span className="sm:hidden">Filters</span>
        {count > 0 && <span className="font-mono tabular-nums">· {count}</span>}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="More filters"
        onSubmit={apply}
        footer={
          <FormFooter>
            <Button type="button" variant="outline" onClick={() => { setType("all"); setTagId(null); }}>
              Reset
            </Button>
            <Button type="submit">Show transactions</Button>
          </FormFooter>
        }
      >
        <Field label="Type">
          <SegmentedControl ariaLabel="Type" value={type} onChange={setType} options={TYPE_OPTIONS} />
        </Field>
        <Field label="Tag">
          <OptionSelect
            ariaLabel="Tag"
            value={tagId}
            onChange={setTagId}
            noneLabel="Any tag"
            options={tags.map((t) => ({ value: t.id, label: `#${t.name}` }))}
          />
        </Field>
      </FormDialog>
    </>
  );
}

// Doesn't fire immediately — debounced ~300ms so the ledger doesn't
// re-query on every keystroke. Tracks the last value it itself emitted so an
// EXTERNAL change (e.g. "Clear all", or browser back/forward) correctly
// resets the local draft, without the debounce echoing its own emission back
// into a reset.
function SearchInput({
  value,
  onChange,
  inputRef,
  autoFocus,
  className,
}: {
  value?: string;
  onChange: (v?: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  className?: string;
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

  // Reset the local draft only when an EXTERNAL value change arrives —
  // adjusted during render (React's "adjusting state when a prop changes"
  // pattern) rather than inside an effect. Guarded by lastEmitted so the
  // debounce's own emission — echoed back down once the URL/props update —
  // doesn't stomp a newer local edit made in the meantime.
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
      ref={inputRef}
      type="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Search notes or #tags"
      aria-label="Search notes or tags"
      autoFocus={autoFocus}
      className={className}
    />
  );
}
