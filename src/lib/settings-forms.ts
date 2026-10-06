// Rules behind the Settings forms (categories, budget items, rules, tags).
// Pure and client-safe, so the dialogs stay presentational.

import type { RuleMatchType } from "@/generated/prisma";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Why a category can't be deleted yet, or null when it can. */
export function categoryDeleteBlocker(counts: {
  transactions: number;
  rules: number;
  mappings: number;
  recurring: number;
}): string | null {
  const parts = [
    counts.transactions > 0 ? plural(counts.transactions, "transaction", "transactions") : null,
    counts.rules > 0 ? plural(counts.rules, "rule", "rules") : null,
    counts.recurring > 0 ? plural(counts.recurring, "recurring expense", "recurring expenses") : null,
    counts.mappings > 0 ? plural(counts.mappings, "legacy mapping", "legacy mappings") : null,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list} still use it. Move them to another category first.`;
}

/** What's missing before a budget item can be saved ("" when ready). */
export function budgetItemMissingHint(name: string, amountDigits: string): string {
  if (!name.trim()) return "Name the item.";
  if (!(parseFloat(amountDigits) > 0)) return "Add the monthly amount.";
  return "";
}

export const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  ACCOUNT: "Account",
  MERCHANT: "Merchant",
  SENDER: "Sender",
  KEYWORD: "Keyword",
};

/** Label and example for the match value, per match type. */
export const MATCH_VALUE_FIELD: Record<RuleMatchType, { label: string; placeholder: string; hint: string }> = {
  ACCOUNT: { label: "Account number", placeholder: "e.g. 61793614704", hint: "Only the digits are compared." },
  MERCHANT: { label: "Merchant name", placeholder: "e.g. RAPPI", hint: "As it appears in the bank message." },
  SENDER: { label: "Sender name", placeholder: "e.g. JUAN PEREZ", hint: "As it appears in the bank message." },
  KEYWORD: { label: "Keyword", placeholder: "e.g. NETFLIX", hint: "Matches when the message contains it." },
};

/** What's missing before a rule can be saved ("" when ready). */
export function ruleMissingHint(values: { matchType: RuleMatchType; matchValue: string; appCategoryId: string; walletId: string }): string {
  if (!values.matchValue.trim()) return `Add the ${MATCH_VALUE_FIELD[values.matchType].label.toLowerCase()}.`;
  if (!values.appCategoryId) return "Pick a category.";
  if (!values.walletId) return "Pick a wallet.";
  return "";
}
