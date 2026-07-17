import { db } from "@/lib/db";
import type { RuleMatchType, RuleDirection } from "@/generated/prisma";
import { normalizeMatchValue } from "@/lib/normalize-match-value";

export type CounterpartyRuleRow = {
  id: string;
  matchType: RuleMatchType;
  matchValue: string;
  direction: RuleDirection;
  appCategoryId: string;
  appCategoryName: string;
  wallet: string;
  // Wallet partition this rule routes to (ADR-036/037-style upgrade). Null
  // until backfilled/resolved via a curated Wallet picker or resolveWalletId().
  walletId: string | null;
  autoRecord: boolean;
  recurring: boolean;
  expectedAmount: number | null;
  notes: string | null;
  matchCount: number;
  lastMatchedAt: Date | null;
  createdAt: Date;
};

/**
 * All CounterpartyRules, one row per rule with the category name resolved.
 * Serves two consumers: the settings page list (a following Frontend pass)
 * and the `get_counterparty_rules` agent read tool — one query, no
 * duplication. Ordered by matchType then matchValue: a deterministic,
 * management-friendly grouping (as opposed to lastMatchedAt desc, which would
 * make a freshly created never-matched rule jump around/sit last — confusing
 * in a CRUD list).
 */
export async function getCounterpartyRules(): Promise<CounterpartyRuleRow[]> {
  const rules = await db.counterpartyRule.findMany({
    include: { appCategory: true },
    orderBy: [{ matchType: "asc" }, { matchValue: "asc" }],
  });

  return rules.map((rule) => ({
    id: rule.id,
    matchType: rule.matchType,
    matchValue: rule.matchValue,
    direction: rule.direction,
    appCategoryId: rule.appCategoryId,
    appCategoryName: rule.appCategory.name,
    wallet: rule.wallet,
    walletId: rule.walletId,
    autoRecord: rule.autoRecord,
    recurring: rule.recurring,
    expectedAmount: rule.expectedAmount,
    notes: rule.notes,
    matchCount: rule.matchCount,
    lastMatchedAt: rule.lastMatchedAt,
    createdAt: rule.createdAt,
  }));
}

export type CounterpartyMatchCandidates = {
  account?: string;
  merchant?: string;
  sender?: string;
  direction: "EXPENSE" | "INCOME";
};

// Priority order: ACCOUNT is the most specific/reliable signal a Colombian
// bank message gives for a transfer (an account number rarely collides),
// MERCHANT next (card purchases), SENDER last (inbound transfers, freest
// text). Tried in one bundle call rather than one matchType at a time, so
// the caller (resolveAddTransaction) doesn't have to re-implement this
// priority order itself, and the direction filter lives in one place.
const MATCH_PRIORITY: { matchType: RuleMatchType; key: keyof CounterpartyMatchCandidates }[] = [
  { matchType: "ACCOUNT", key: "account" },
  { matchType: "MERCHANT", key: "merchant" },
  { matchType: "SENDER", key: "sender" },
];

function directionMatches(ruleDirection: RuleDirection, direction: "EXPENSE" | "INCOME"): boolean {
  return ruleDirection === "ANY" || ruleDirection === direction;
}

/**
 * Looks up a CounterpartyRule matching any of the given candidate values
 * (tried ACCOUNT → MERCHANT → SENDER) and the message's direction. Returns
 * the first match, or null if none. Pure read — does NOT bump matchCount/
 * lastMatchedAt (see bumpCounterpartyRuleMatch): a lookup that matched but
 * was not ultimately used (low-confidence parse, autoRecord: false) should
 * not count as a real match.
 */
export async function matchCounterpartyRule(
  candidates: CounterpartyMatchCandidates,
): Promise<CounterpartyRuleRow | null> {
  for (const { matchType, key } of MATCH_PRIORITY) {
    const raw = candidates[key] as string | undefined;
    if (!raw) continue;

    const normalized = normalizeMatchValue(matchType, raw);
    if (!normalized) continue;

    const rule = await db.counterpartyRule.findFirst({
      where: { matchType, matchValue: normalized },
      include: { appCategory: true },
    });
    if (rule && directionMatches(rule.direction, candidates.direction)) {
      return {
        id: rule.id,
        matchType: rule.matchType,
        matchValue: rule.matchValue,
        direction: rule.direction,
        appCategoryId: rule.appCategoryId,
        appCategoryName: rule.appCategory.name,
        wallet: rule.wallet,
        walletId: rule.walletId,
        autoRecord: rule.autoRecord,
        recurring: rule.recurring,
        expectedAmount: rule.expectedAmount,
        notes: rule.notes,
        matchCount: rule.matchCount,
        lastMatchedAt: rule.lastMatchedAt,
        createdAt: rule.createdAt,
      };
    }
  }
  return null;
}

/**
 * Bumps matchCount/lastMatchedAt for a rule that was actually used to
 * auto-record a transaction. Called explicitly by the auto-record path,
 * never from matchCounterpartyRule itself (see its doc comment).
 */
export async function bumpCounterpartyRuleMatch(ruleId: string): Promise<void> {
  await db.counterpartyRule.update({
    where: { id: ruleId },
    data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() },
  });
}
