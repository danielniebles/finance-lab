// Display rules for the Expenses ledger: wallet quick-filter chips, the
// remembered default wallet, and the filter-state labels. Pure, tested.

export type WalletChipOption = { id: string; name: string; color: string | null };

/** Cookie remembering the last wallet picked on the ledger: a wallet id or `all`. */
export const LEDGER_WALLET_COOKIE = "ledger_wallet";
/** Explicit "All wallets" value, in the URL and the cookie, so it beats the remembered wallet. */
export const ALL_WALLETS = "all";

/**
 * Which wallets get a chip and which go under "N more". Wallets with
 * transactions this period come first (most transactions first), then the
 * rest in their given order (account, then sortOrder). The selected wallet is
 * always visible: if it would fall into "more", it takes the last chip slot.
 */
export function walletChips(
  wallets: WalletChipOption[],
  activity: Record<string, number>,
  selectedId: string | undefined,
  max = 4,
): { visible: WalletChipOption[]; more: WalletChipOption[] } {
  const ordered = wallets
    .map((wallet, index) => ({ wallet, index, count: activity[wallet.id] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((entry) => entry.wallet);
  const visible = ordered.slice(0, max);
  const selected = ordered.find((w) => w.id === selectedId);
  if (selected && !visible.includes(selected) && max > 0) {
    visible[visible.length - 1] = selected;
  }
  return { visible, more: ordered.filter((w) => !visible.includes(w)) };
}

/**
 * The wallet the ledger is scoped to: the URL wins (`all` = none), else the
 * remembered cookie, else none. Unknown ids (a deleted wallet) resolve to none.
 */
export function resolveLedgerWallet(
  param: string | undefined,
  cookie: string | undefined,
  walletIds: string[],
): string | undefined {
  const value = param || cookie;
  if (!value || value === ALL_WALLETS) return undefined;
  return walletIds.includes(value) ? value : undefined;
}

export type LedgerFilterState = {
  category?: string;
  type?: "expense" | "income";
  search?: string;
  tagId?: string;
};

export type ActiveFilter = { key: keyof LedgerFilterState; label: string };

const TYPE_FILTER_LABEL = { expense: "Expenses only", income: "Income only" } as const;

/**
 * The filters listed on the "Showing …" line, in display order. Wallet is
 * not one of them: the wallet chip row already shows it.
 */
export function activeFilters(
  filters: LedgerFilterState,
  tags: { id: string; name: string }[],
): ActiveFilter[] {
  const list: ActiveFilter[] = [];
  if (filters.category) list.push({ key: "category", label: filters.category });
  if (filters.type) list.push({ key: "type", label: TYPE_FILTER_LABEL[filters.type] });
  const tag = filters.tagId ? tags.find((t) => t.id === filters.tagId) : undefined;
  if (filters.tagId) list.push({ key: "tagId", label: `#${tag?.name ?? "tag"}` });
  if (filters.search) list.push({ key: "search", label: `“${filters.search}”` });
  return list;
}

/** How many of the "More filters" sheet's filters (type, tag) are on. */
export function moreFiltersCount(filters: LedgerFilterState): number {
  return (filters.type ? 1 : 0) + (filters.tagId ? 1 : 0);
}

/** Toolbar count: "17", or "2 of 17" when anything narrows the list. */
export function transactionCountLabel(shown: number, total: number, filtered: boolean): string {
  return filtered ? `${shown} of ${total}` : String(total);
}

