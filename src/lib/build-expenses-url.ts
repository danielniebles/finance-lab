export type ExpensesSearchParams = Record<string, string | undefined>;

/**
 * Builds an /expenses URL from the current query params, patched with
 * overrides. Every control that changes ONE thing (month, view, a single
 * filter) should go through this so it never drops the others — e.g.
 * changing month must not reset view back to the default, and switching
 * view must not drop the wallet filter.
 */
export function buildExpensesUrl(
  current: ExpensesSearchParams,
  overrides: ExpensesSearchParams,
): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  return `/expenses?${params.toString()}`;
}
