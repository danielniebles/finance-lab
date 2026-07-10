import { db } from "@/lib/db";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import type { TransactionSource } from "@/generated/prisma";

export type LedgerGroupBy = "day" | "category" | "wallet";

export type LedgerFilters = {
  category?: string; // AppCategory name (resolved, not an id)
  // Legacy exact-label filter (ADR-035 era). No longer applied by matchesWallet
  // (Wallet.name values from ADR-036/037 don't match this MoneyLover payment-method
  // label space at all — see .scratch/wallet-ledger-filter-fix.md). Kept only so
  // existing UI (ledger-controls.tsx's WalletSelect, a Frontend-owned follow-up)
  // still type-checks pending its migration to walletId.
  wallet?: string;
  walletId?: string; // Wallet.id — the real wallet-partition filter (ADR-036/037)
  type?: "expense" | "income"; // amount sign
  search?: string; // note contains, case-insensitive
};

export type LedgerItem = {
  id: string;
  date: Date;
  amount: number;
  // Legacy MoneyLover wallet label — retained as the edit-form/display fallback
  // (transaction-row.tsx binds an editable text input to this field, which
  // resolveWalletId() re-resolves into walletId server-side on save). Not used
  // for wallet filtering/grouping anymore — see walletId/walletName below.
  wallet: string;
  walletId: string | null;
  // Resolved Wallet.name via walletId's relation; null iff walletId is null.
  walletName: string | null;
  note: string | null;
  categoryName: string | null;
  source: TransactionSource;
};

export type LedgerGroup = {
  key: string;
  label: string;
  subtotal: number;
  items: LedgerItem[];
};

export type CategorySummaryRow = { name: string; total: number; count: number };

export type TransactionListResult = {
  groups: LedgerGroup[];
  monthTotalExpense: number;
  monthTotalIncome: number;
  categorySummary: CategorySummaryRow[];
};

const UNCATEGORIZED_KEY = "uncategorized";
const UNCATEGORIZED_LABEL = "Sin categoría";
export const UNASSIGNED_WALLET_KEY = "unassigned";
export const UNASSIGNED_WALLET_LABEL = "Sin asignar";

type RawTransaction = {
  id: string;
  date: Date;
  amount: number;
  wallet: string;
  walletId: string | null;
  walletRef: { name: string } | null;
  note: string | null;
  source: TransactionSource;
  appCategory: { name: string } | null;
  moneyLoverCategory: { mapping: { appCategory: { name: string } } | null } | null;
};

// Category resolution rule (ADR-030), applied everywhere a transaction's
// effective category is read: direct appCategoryId (MANUAL) wins, else fall
// back to the MoneyLoverCategory's mapping (MONEYLOVER). Mirrors
// getMonthlyAnalysis's buildSpendByCategory in src/lib/queries/expenses.ts.
function resolveCategoryName(t: RawTransaction): string | null {
  return t.appCategory?.name ?? t.moneyLoverCategory?.mapping?.appCategory?.name ?? null;
}

function toLedgerItem(t: RawTransaction): LedgerItem {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    wallet: t.wallet,
    walletId: t.walletId,
    walletName: t.walletRef?.name ?? null,
    note: t.note,
    categoryName: resolveCategoryName(t),
    source: t.source,
  };
}

// Spanish short date label matching the design spec's example ("Mié 8 jul").
// Intl's default `format()` output for es-CO inserts ", " / " de " separators
// ("mié, 8 de jul") which doesn't match the spec, so the parts are assembled
// by hand instead.
function formatDayLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized} ${get("day")} ${get("month")}`;
}

// Sortable yyyy-mm-dd key from LOCAL date components (mirrors
// financial-period-utils.ts's use of local Date construction) — avoids UTC
// off-by-one-day drift.
function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function matchesCategory(item: LedgerItem, category?: string): boolean {
  return !category || item.categoryName === category;
}

function matchesWallet(item: LedgerItem, walletId?: string): boolean {
  return !walletId || item.walletId === walletId;
}

function matchesType(item: LedgerItem, type?: "expense" | "income"): boolean {
  if (type === "expense") return item.amount < 0;
  if (type === "income") return item.amount > 0;
  return true;
}

function matchesSearch(item: LedgerItem, search?: string): boolean {
  const needle = search?.trim().toLowerCase();
  return !needle || (item.note ?? "").toLowerCase().includes(needle);
}

function matchesFilters(item: LedgerItem, filters?: LedgerFilters): boolean {
  if (!filters) return true;
  return (
    matchesCategory(item, filters.category) &&
    matchesWallet(item, filters.walletId) &&
    matchesType(item, filters.type) &&
    matchesSearch(item, filters.search)
  );
}

function sumAmounts(items: LedgerItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

function buildDayGroups(items: LedgerItem[]): LedgerGroup[] {
  const byDay = new Map<string, LedgerItem[]>();
  for (const item of items) {
    const key = dayKey(item.date);
    const bucket = byDay.get(key) ?? [];
    bucket.push(item);
    byDay.set(key, bucket);
  }
  return [...byDay.entries()]
    .map(([key, dayItems]) => ({
      key,
      label: formatDayLabel(dayItems[0].date),
      subtotal: sumAmounts(dayItems),
      items: dayItems,
    }))
    .sort((a, b) => b.key.localeCompare(a.key)); // newest first
}

// Shared by "category" and "wallet" grouping — both key/label off a single
// resolved string per item and sort by |subtotal| descending.
function buildKeyedGroups(
  items: LedgerItem[],
  keyOf: (item: LedgerItem) => { key: string; label: string },
): LedgerGroup[] {
  const byKey = new Map<string, { label: string; items: LedgerItem[] }>();
  for (const item of items) {
    const { key, label } = keyOf(item);
    const bucket = byKey.get(key) ?? { label, items: [] };
    bucket.items.push(item);
    byKey.set(key, bucket);
  }
  return [...byKey.entries()]
    .map(([key, { label, items: groupItems }]) => ({
      key,
      label,
      subtotal: sumAmounts(groupItems),
      items: groupItems,
    }))
    .sort((a, b) => Math.abs(b.subtotal) - Math.abs(a.subtotal));
}

function buildGroups(items: LedgerItem[], groupBy: LedgerGroupBy): LedgerGroup[] {
  if (groupBy === "day") return buildDayGroups(items);
  if (groupBy === "category") {
    return buildKeyedGroups(items, (item) =>
      item.categoryName
        ? { key: item.categoryName, label: item.categoryName }
        : { key: UNCATEGORIZED_KEY, label: UNCATEGORIZED_LABEL },
    );
  }
  return buildKeyedGroups(items, (item) =>
    item.walletId && item.walletName
      ? { key: item.walletId, label: item.walletName }
      : { key: UNASSIGNED_WALLET_KEY, label: UNASSIGNED_WALLET_LABEL },
  );
}

// Flat per-category totals across the CURRENT (filtered) item set — deliberately
// affected by active filters (per the handoff), unlike monthTotalExpense/Income
// below which stay whole-month so the ledger's header band always agrees with
// getMonthlyAnalysis regardless of what the user is currently filtering to.
// Uncategorized transactions are excluded here (this panel lists named
// categories only); groupBy="category" mode still buckets them separately.
function computeCategorySummary(items: LedgerItem[]): CategorySummaryRow[] {
  const byName = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    if (!item.categoryName) continue;
    const entry = byName.get(item.categoryName) ?? { total: 0, count: 0 };
    entry.total += item.amount;
    entry.count += 1;
    byName.set(item.categoryName, entry);
  }
  return [...byName.entries()]
    .map(([name, { total, count }]) => ({ name, total, count }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

/**
 * Granular transaction ledger for one financial month — grouped by day,
 * category, or wallet, with optional filters. Date-range scoped exactly like
 * getMonthlyAnalysis (ADR-030), so MANUAL rows with no ImportBatch are
 * included alongside MoneyLover rows.
 *
 * monthTotalExpense/monthTotalIncome are always computed from the FULL
 * month's transactions and ignore category/type/search filters (so this
 * view's header band stays consistent with getMonthlyAnalysis's totals for
 * the same month no matter what the user has filtered the list down to) —
 * EXCEPT walletId, which does scope them: when filters.walletId is set, both
 * totals reflect only that wallet's transactions for the month (still the
 * whole month, just restricted to one wallet's balance), since the header
 * band is expected to track the selected wallet.
 */
export async function getTransactionList(
  month: number,
  year: number,
  groupBy: LedgerGroupBy = "day",
  filters?: LedgerFilters,
): Promise<TransactionListResult> {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);

  const transactions = await db.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    include: {
      appCategory: true,
      moneyLoverCategory: { include: { mapping: { include: { appCategory: true } } } },
      walletRef: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  const allItems = transactions.map(toLedgerItem);

  // Only walletId scopes the two month totals (see JSDoc above); category/
  // type/search stay whole-month by design, so this set is NOT filteredItems.
  const walletScopedItems = allItems.filter((item) => matchesWallet(item, filters?.walletId));

  const monthTotalIncome = walletScopedItems
    .filter((item) => item.amount > 0)
    .reduce((sum, item) => sum + item.amount, 0);
  const monthTotalExpense = walletScopedItems
    .filter((item) => item.amount < 0)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);

  const filteredItems = allItems.filter((item) => matchesFilters(item, filters));

  return {
    groups: buildGroups(filteredItems, groupBy),
    monthTotalExpense,
    monthTotalIncome,
    categorySummary: computeCategorySummary(filteredItems),
  };
}
