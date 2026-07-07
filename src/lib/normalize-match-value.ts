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
