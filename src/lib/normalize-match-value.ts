// Shared normalization for CounterpartyRule.matchValue. Standalone (not
// inside actions/ or queries/) because it is consumed by two independent
// layers: the write path here (actions/counterparty-rules.ts) and, in a
// later Backend pass, the ingestion rule-matching path — a pure helper two
// layers share belongs beside them, not inside either one (mirrors why
// financial-period-utils.ts sits next to queries/ rather than inside it).
//
// LOAD-BEARING: the ingestion pass MUST import and reuse this exact function
// to normalize an extracted counterparty value before matching against
// stored rules. Reinventing normalization there would silently break
// matching (e.g. a differently-stripped account number never matching a
// rule whose matchValue was normalized here).

import type { RuleMatchType } from "@/generated/prisma";

/**
 * Normalizes a raw matchValue the same way for both storage (create/update)
 * and lookup (ingestion matching), so the two sides can never drift:
 * - ACCOUNT: digits-only (strips spaces, dashes, "cuenta", etc.)
 * - MERCHANT / SENDER / KEYWORD: trimmed + uppercased
 */
export function normalizeMatchValue(matchType: RuleMatchType, raw: string): string {
  if (matchType === "ACCOUNT") {
    return raw.replace(/\D/g, "");
  }
  return raw.trim().toUpperCase();
}

/**
 * Loose comparison key for MERCHANT/SENDER values: uppercased, accents
 * dropped, everything but letters and digits removed. Bank messages spell
 * the same merchant several ways ("UBER RIDES", "UBER*RIDES", "UBERRIDES"),
 * so rules are compared on this key, not on the stored matchValue. The stored
 * value stays readable (normalizeMatchValue) — only the comparison is loose.
 */
export function counterpartyMatchKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

// A rule key this short ("UB", "A") would match almost anything as a prefix.
export const MIN_PREFIX_KEY_LENGTH = 4;

/**
 * True when a rule's key matches a candidate's key: equal, or the rule key
 * is a prefix of the candidate (rule "UBERRIDES" matches "UBER RIDES*DL").
 */
export function counterpartyKeyMatches(ruleKey: string, candidateKey: string): boolean {
  if (!ruleKey || !candidateKey) return false;
  if (ruleKey === candidateKey) return true;
  return ruleKey.length >= MIN_PREFIX_KEY_LENGTH && candidateKey.startsWith(ruleKey);
}

/**
 * True when a raw "counterpartyAccount" extraction actually contains an
 * account number. Colombian bank transfer notifications often identify the
 * destination by the recipient's full name only ("Cuenta MARIA NELLY...",
 * no digits anywhere) — the model still extracts that into
 * counterpartyAccount because the message literally said "cuenta". Such a
 * value normalizes to "" via normalizeMatchValue("ACCOUNT", ...) above, and
 * matchCounterpartyRule explicitly skips empty normalized values — so an
 * ACCOUNT-typed rule built from it, or a lookup keyed on it, can NEVER
 * match anything. Callers translating raw extraction into match candidates
 * (proposals/transactions.ts's lookupRuleFromInput, execute-proposal.ts's
 * learn-rule nudge) must reclassify a name-only "account" as a MERCHANT
 * candidate instead — confirmed 2026-08-25 investigating why a "remember
 * this merchant" rule never fired for exactly this kind of transfer.
 */
export function looksLikeRealAccountNumber(raw: string): boolean {
  return /\d/.test(raw);
}
