// Counterparty rule proposal resolvers (propose_create/update/delete_counterparty_rule).
// Mirrors the shape of proposals/accounts.ts / proposals/loans.ts — name → id
// resolution via blockingProposal/buildResolvedProposal from ./shared.
//
// DEVIATION from resolveAddTransaction's category resolution (proposals/transactions.ts):
// that resolver silently falls back to "first category alphabetically" when the name
// doesn't resolve, because category is always editable on that card. Here there is no
// editable-category mechanism, and a rule silently attached to the wrong category would
// misroute every future matching transaction — so an unresolved appCategoryName BLOCKS
// instead of falling back.
//
// Update/delete target an existing rule by `ruleId` (the agent calls
// get_counterparty_rules first to resolve it) rather than re-matching on
// matchValue — avoids ambiguity from guessing which normalization the caller
// meant, and keeps this resolver's job to "resolve category name", not
// "re-implement rule lookup".

import { getCategories, type CategoryOption } from "@/lib/queries/expenses";
import { getCounterpartyRules, type CounterpartyRuleRow } from "@/lib/queries/counterparty-rules";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";

function findCategoryByName(
  categories: CategoryOption[],
  name: string,
): CategoryOption | undefined {
  const lower = name.toLowerCase().trim();
  const exact = categories.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact;
  return categories.find((c) => c.name.toLowerCase().includes(lower));
}

function categoryNotFoundMessage(categories: CategoryOption[], name: string): string {
  return `AppCategory "${name}" not found. Available categories: ${categories
    .map((c) => c.name)
    .join(", ")}. Ask the user which category to use, or check for a typo.`;
}

function ruleNotFoundMessage(rules: CounterpartyRuleRow[], ruleId: string): string {
  const known = rules.map((r) => `${r.id} (${r.matchType} ${r.matchValue})`).join(", ") || "none";
  return `No counterparty rule found with id "${ruleId}". Call get_counterparty_rules to see existing rules. Existing: ${known}.`;
}

type RuleFieldInput = {
  matchType: string;
  matchValue: string;
  direction: string;
  wallet: string;
  autoRecord: boolean;
  recurring: boolean;
  expectedAmount?: number;
  notes?: string;
};

function ruleFields(
  categoryName: string,
  input: RuleFieldInput,
): { label: string; value: string }[] {
  return [
    { label: "Match type", value: input.matchType },
    { label: "Match value", value: input.matchValue },
    { label: "Direction", value: input.direction },
    { label: "Category", value: categoryName },
    { label: "Wallet", value: input.wallet },
    { label: "Auto-record", value: input.autoRecord ? "Yes" : "No" },
    { label: "Recurring", value: input.recurring ? "Yes" : "No" },
    ...(input.expectedAmount != null
      ? [{ label: "Expected amount", value: String(input.expectedAmount) }]
      : []),
    { label: "Notes", value: input.notes ?? "—" },
  ];
}

export async function resolveCreateCounterpartyRule(
  input: Record<string, unknown>,
): Promise<ResolvedProposal> {
  const matchType = input.matchType as string;
  const matchValue = input.matchValue as string;
  const direction = (input.direction as string | undefined) ?? "ANY";
  const appCategoryName = input.appCategoryName as string;
  const wallet = input.wallet as string;
  const autoRecord = (input.autoRecord as boolean | undefined) ?? true;
  const recurring = (input.recurring as boolean | undefined) ?? false;
  const expectedAmount = input.expectedAmount as number | undefined;
  const notes = input.notes as string | undefined;

  const categories = await getCategories();
  const category = findCategoryByName(categories, appCategoryName);
  if (!category) {
    return blockingProposal(
      "Create counterparty rule",
      categoryNotFoundMessage(categories, appCategoryName),
      input,
    );
  }

  const params: Record<string, unknown> = {
    matchType,
    matchValue,
    direction,
    appCategoryId: category.id,
    wallet,
    autoRecord,
    recurring,
    expectedAmount: expectedAmount ?? null,
    notes: notes ?? null,
  };

  const title = `Create rule: ${matchType} "${matchValue}" → ${category.name}`;
  const fields = ruleFields(category.name, {
    matchType,
    matchValue,
    direction,
    wallet,
    autoRecord,
    recurring,
    expectedAmount,
    notes,
  });

  return buildResolvedProposal(params, title, fields);
}

/** Merge partial update input over the existing rule's stored fields. */
function mergeRuleUpdate(
  rule: CounterpartyRuleRow,
  input: Record<string, unknown>,
): RuleFieldInput {
  return {
    matchType: (input.matchType as string | undefined) ?? rule.matchType,
    matchValue: (input.matchValue as string | undefined) ?? rule.matchValue,
    direction: (input.direction as string | undefined) ?? rule.direction,
    wallet: (input.wallet as string | undefined) ?? rule.wallet,
    autoRecord: (input.autoRecord as boolean | undefined) ?? rule.autoRecord,
    recurring: (input.recurring as boolean | undefined) ?? rule.recurring,
    expectedAmount:
      (input.expectedAmount as number | undefined) ?? rule.expectedAmount ?? undefined,
    notes: (input.notes as string | undefined) ?? rule.notes ?? undefined,
  };
}

/** Resolve the target category for an update: explicit override name, or the rule's current category. */
function resolveUpdateCategory(
  rule: CounterpartyRuleRow,
  categories: CategoryOption[],
  appCategoryName: string | undefined,
): CategoryOption | undefined {
  if (!appCategoryName) {
    return categories.find((c) => c.id === rule.appCategoryId);
  }
  return findCategoryByName(categories, appCategoryName);
}

export async function resolveUpdateCounterpartyRule(
  input: Record<string, unknown>,
): Promise<ResolvedProposal> {
  const ruleId = input.ruleId as string;
  const appCategoryName = input.appCategoryName as string | undefined;

  const [rules, categories] = await Promise.all([getCounterpartyRules(), getCategories()]);
  const rule = rules.find((r) => r.id === ruleId);

  if (!rule) {
    return blockingProposal(
      "Update counterparty rule",
      ruleNotFoundMessage(rules, ruleId),
      input,
    );
  }

  const category = resolveUpdateCategory(rule, categories, appCategoryName);
  if (!category) {
    return blockingProposal(
      "Update counterparty rule",
      categoryNotFoundMessage(categories, appCategoryName as string),
      input,
    );
  }

  const merged = mergeRuleUpdate(rule, input);

  const params: Record<string, unknown> = {
    ruleId: rule.id,
    matchType: merged.matchType,
    matchValue: merged.matchValue,
    direction: merged.direction,
    appCategoryId: category.id,
    wallet: merged.wallet,
    autoRecord: merged.autoRecord,
    recurring: merged.recurring,
    expectedAmount: merged.expectedAmount ?? null,
    notes: merged.notes ?? null,
  };

  const title = `Update rule: ${rule.matchType} "${rule.matchValue}" → ${category.name}`;
  const fields = ruleFields(category.name, merged);

  return buildResolvedProposal(params, title, fields);
}

export async function resolveDeleteCounterpartyRule(
  input: Record<string, unknown>,
): Promise<ResolvedProposal> {
  const ruleId = input.ruleId as string;

  const rules = await getCounterpartyRules();
  const rule = rules.find((r) => r.id === ruleId);

  if (!rule) {
    return blockingProposal(
      "Delete counterparty rule",
      ruleNotFoundMessage(rules, ruleId),
      input,
    );
  }

  const params: Record<string, unknown> = { ruleId: rule.id };

  const title = `Delete rule: ${rule.matchType} "${rule.matchValue}" → ${rule.appCategoryName}`;
  const fields: { label: string; value: string }[] = [
    { label: "Match type", value: rule.matchType },
    { label: "Match value", value: rule.matchValue },
    { label: "Category", value: rule.appCategoryName },
    { label: "Wallet", value: rule.wallet },
  ];

  return buildResolvedProposal(params, title, fields);
}
