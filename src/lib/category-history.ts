// Picks a category from the user's own past transactions with the same
// counterparty — the fallback when the model's category guess names no real
// category (ADR-061). Pure, so the matching rule is tested without a DB.

import {
  counterpartyKeyMatches,
  counterpartyMatchKey,
  MIN_PREFIX_KEY_LENGTH,
} from "@/lib/normalize-match-value";

export type CategoryHistoryRow = { note: string | null; appCategoryId: string | null };

/**
 * Text used to pre-filter past transactions in SQL (a cheap `contains`) before
 * the exact key comparison: the first few letters of the counterparty's first
 * word, accents dropped. Undefined when the text has no letters or digits.
 */
export function historySearchToken(counterparty: string): string | undefined {
  const word = counterparty
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .match(/[\p{L}\p{N}]+/u)?.[0];
  return word ? word.slice(0, MIN_PREFIX_KEY_LENGTH) : undefined;
}

/**
 * The most frequent category among rows whose note names the same
 * counterparty (equal key, or one is a prefix of the other: a past note
 * "Uber" counts for "UBER RIDES"). Rows are expected newest first, so a tie
 * goes to the category used most recently.
 */
export function pickHistoricalCategoryId(
  rows: CategoryHistoryRow[],
  counterparty: string,
): string | undefined {
  const key = counterpartyMatchKey(counterparty);
  if (!key) return undefined;

  const counts = new Map<string, number>();
  for (const { note, appCategoryId } of rows) {
    if (!note || !appCategoryId) continue;
    const noteKey = counterpartyMatchKey(note);
    if (!counterpartyKeyMatches(noteKey, key) && !counterpartyKeyMatches(key, noteKey)) continue;
    counts.set(appCategoryId, (counts.get(appCategoryId) ?? 0) + 1);
  }

  let best: { id: string; count: number } | undefined;
  for (const [id, count] of counts) {
    if (!best || count > best.count) best = { id, count };
  }
  return best?.id;
}
