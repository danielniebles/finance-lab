import { db } from "@/lib/db";
import type { Prisma, RuleMatchType, RuleDirection } from "@/generated/prisma";
import {
  counterpartyKeyMatches,
  counterpartyMatchKey,
  normalizeMatchValue,
} from "@/lib/normalize-match-value";

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
  // Tags this rule applies to every transaction it matches/auto-records —
  // see prisma/schema.prisma's CounterpartyRule.tags comment.
  tagNames: string[];
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
    include: { appCategory: true, tags: true },
    orderBy: [{ matchType: "asc" }, { matchValue: "asc" }],
  });

  return rules.map(toRuleRow);
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

type RuleWithRelations = Prisma.CounterpartyRuleGetPayload<{
  include: { appCategory: true; tags: true };
}>;

function toRuleRow(rule: RuleWithRelations): CounterpartyRuleRow {
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
    tagNames: rule.tags.map((t) => t.name),
  };
}

/**
 * Picks the best MERCHANT/SENDER rule for a candidate key: an exact key match
 * first, else the longest rule key that is a prefix of the candidate (the
 * most specific rule wins). Ties keep the input order (oldest rule first).
 */
export function pickLooseRule<T extends { matchValue: string }>(
  rules: T[],
  candidateKey: string,
): T | undefined {
  let best: { rule: T; length: number } | undefined;
  for (const rule of rules) {
    const ruleKey = counterpartyMatchKey(rule.matchValue);
    if (!counterpartyKeyMatches(ruleKey, candidateKey)) continue;
    if (ruleKey === candidateKey) return rule;
    if (!best || ruleKey.length > best.length) best = { rule, length: ruleKey.length };
  }
  return best?.rule;
}

async function findRule(
  matchType: RuleMatchType,
  raw: string,
  direction: "EXPENSE" | "INCOME",
): Promise<RuleWithRelations | null> {
  // ACCOUNT stays an exact digits-only match: account numbers don't vary in
  // spelling, and a prefix of one is a different account.
  if (matchType === "ACCOUNT") {
    const normalized = normalizeMatchValue(matchType, raw);
    if (!normalized) return null;
    const rule = await db.counterpartyRule.findFirst({
      where: { matchType, matchValue: normalized },
      include: { appCategory: true, tags: true },
    });
    return rule && directionMatches(rule.direction, direction) ? rule : null;
  }

  // MERCHANT/SENDER: compared on a loose key (see counterpartyMatchKey), so
  // the candidates are filtered in memory. The rule table is small.
  const candidateKey = counterpartyMatchKey(raw);
  if (!candidateKey) return null;
  const rules = await db.counterpartyRule.findMany({
    where: { matchType },
    include: { appCategory: true, tags: true },
    orderBy: { createdAt: "asc" },
  });
  const eligible = rules.filter((r) => directionMatches(r.direction, direction));
  return pickLooseRule(eligible, candidateKey) ?? null;
}

/**
 * Looks up a CounterpartyRule matching any of the given candidate values
 * (tried ACCOUNT → MERCHANT → SENDER) and the message's direction. ACCOUNT
 * matches exactly; MERCHANT/SENDER match loosely ("UBER RIDES" finds a
 * "UBER*RIDES" rule, "UBER RIDES*DL" finds a "UBERRIDES" rule). Returns the
 * first match, or null if none. Pure read — does NOT bump matchCount/
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
    const rule = await findRule(matchType, raw, candidates.direction);
    if (rule) return toRuleRow(rule);
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
