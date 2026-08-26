import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PROPOSAL_ACTIONS } from "@/lib/agent/actions";
import { DEFAULT_APPROVE_MESSAGE } from "@/lib/agent/types";
import { looksLikeRealAccountNumber } from "@/lib/normalize-match-value";

export type ProposalDecision = {
  proposalId: string;
  choiceId: "approve" | "dismiss";
};

export type ResolveProposalResult = {
  ok: boolean;
  message: string;
  /**
   * Learn-from-correction nudge (ADR-033, Part 3): set when a
   * propose_add_transaction with an extracted counterparty was approved but
   * had NO CounterpartyRule match at all — offered as a plain follow-up chat
   * suggestion rather than a second interactive card, kept deliberately
   * lightweight per the handoff. Undefined in every other case (unchanged
   * behavior for every action that isn't propose_add_transaction, and for a
   * transaction with no extractable counterparty).
   */
  learnRuleNudge?: string;
};

// Mirrors MATCH_PRIORITY in queries/counterparty-rules.ts — same priority
// order (ACCOUNT > MERCHANT > SENDER) and the same field the counterparty
// came from, so the rule this nudge offers to create is the exact rule
// matchCounterpartyRule would actually look up next time.
const COUNTERPARTY_FIELDS = [
  { param: "counterpartyAccount", matchType: "ACCOUNT" },
  { param: "counterpartyMerchant", matchType: "MERCHANT" },
  { param: "counterpartySender", matchType: "SENDER" },
] as const;

/**
 * Builds the "remember this?" nudge text when an approved transaction had an
 * extractable counterparty but matched no existing rule. Only fires on the
 * genuinely-unmatched case (`hadCounterpartyMatch === false`), not merely
 * "wasn't auto-recorded" — a match with autoRecord:false already has a rule,
 * there's nothing to learn.
 *
 * Spells out matchType/matchValue/category/wallet/tags explicitly (rather
 * than the old vague "same category and wallet") because this text is now
 * the ONLY record of the offer the model sees on a later "yes" turn (see
 * telegram/route.ts's saveMessage call) — it has no other way to reconstruct
 * a propose_create_counterparty_rule call from history.
 */
async function buildLearnRuleNudge(
  action: string,
  params: Record<string, unknown>,
): Promise<string | undefined> {
  if (action !== "propose_add_transaction" || params.hadCounterpartyMatch !== false) {
    return undefined;
  }
  const matched = COUNTERPARTY_FIELDS.find(({ param }) => params[param]);
  if (!matched) return undefined;
  const counterparty = params[matched.param] as string;
  // Mirrors proposals/transactions.ts's lookupRuleFromInput reclassification:
  // a counterpartyAccount value with no digits at all is a named-recipient
  // transfer, not a real account number — offer (and later create) a
  // MERCHANT rule instead, matching what the lookup will actually search on.
  const matchType =
    matched.param === "counterpartyAccount" && !looksLikeRealAccountNumber(counterparty)
      ? "MERCHANT"
      : matched.matchType;

  const appCategoryId = params.appCategoryId as string | undefined;
  const category = appCategoryId
    ? await db.appCategory.findUnique({ where: { id: appCategoryId }, select: { name: true } })
    : null;
  const wallet = params.wallet as string | undefined;
  const tagNames = (params.tagNames as string[] | undefined) ?? [];
  const tagsPart = tagNames.length > 0 ? ` tagged ${tagNames.map((t) => `#${t}`).join(" ")}` : "";

  return `💡 Want me to remember this? The next ${matchType} match for "${counterparty}" would auto-record as ${category?.name ?? "this category"} → ${wallet ?? "this wallet"}${tagsPart}. Tell me "yes, remember it" if you want to create the rule.`;
}

/**
 * Runs the registered action (or the special propose_undo_last dispatch),
 * persists any returned extra fields back onto params, and returns the reply
 * message to use — either the generic "Approved" default or, when an
 * action's execute() opted into the generic message escape hatch (e.g. the
 * batch's "Agregadas N · Total X" summary), that string instead. Split out
 * of resolveProposal to keep its cognitive complexity within budget.
 */
async function executeApprovedAction(
  proposalId: string,
  action: string,
  params: Record<string, unknown>,
): Promise<string> {
  if (action === "propose_undo_last") {
    await executeUndo(params);
    return DEFAULT_APPROVE_MESSAGE;
  }

  const def = PROPOSAL_ACTIONS[action];
  if (!def) throw new Error(`No handler for action: ${action}`);
  const extra = await def.execute(params, { proposalId });
  if (!extra || Object.keys(extra).length === 0) {
    return DEFAULT_APPROVE_MESSAGE;
  }

  // A generic escape hatch: an action's execute() may return its own reply
  // text (e.g. the batch's "Agregadas N · Total X" summary) in place of the
  // default "Approved" — checked here rather than a per-action
  // `if (action === ...)` branch, so a THIRD special case never needs to be
  // bolted onto resolveProposal (learnRuleNudge is the second; this
  // generalizes instead of adding a third). `message` itself is never
  // persisted onto params — it's reply text, not proposal state (undo/
  // display never need it back).
  const { message: extraMessage, ...extraToPersist } = extra;
  await db.pendingProposal.update({
    where: { id: proposalId },
    data: {
      params: { ...params, ...extraToPersist } as unknown as Record<string, string>,
    },
  });

  return typeof extraMessage === "string" ? extraMessage : DEFAULT_APPROVE_MESSAGE;
}

export async function resolveProposal(d: ProposalDecision): Promise<ResolveProposalResult> {
  const { proposalId, choiceId } = d;

  const proposal = await db.pendingProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    return { ok: false, message: "Proposal not found." };
  }
  if (proposal.status !== "pending") {
    return { ok: false, message: `Proposal is already ${proposal.status}.` };
  }

  if (choiceId === "dismiss") {
    await db.pendingProposal.update({
      where: { id: proposalId },
      data: { status: "dismissed", resolvedAt: new Date() },
    });
    return { ok: true, message: "Dismissed" };
  }

  // choiceId === "approve" — dispatch via registry
  const params = proposal.params as Record<string, unknown>;

  try {
    const approveMessage = await executeApprovedAction(proposalId, proposal.action, params);

    await db.pendingProposal.update({
      where: { id: proposalId },
      data: { status: "approved", resolvedAt: new Date() },
    });

    revalidatePath("/vaults");
    revalidatePath("/overview");
    revalidatePath("/loans");
    revalidatePath("/installments");
    revalidatePath("/expenses");

    return {
      ok: true,
      message: approveMessage,
      learnRuleNudge: await buildLearnRuleNudge(proposal.action, params),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message };
  }
}

async function executeUndo(params: Record<string, unknown>): Promise<void> {
  const { targetProposalId } = params as { targetProposalId: string };

  const target = await db.pendingProposal.findUniqueOrThrow({
    where: { id: targetProposalId },
  });
  const targetParams = target.params as Record<string, unknown>;

  const def = PROPOSAL_ACTIONS[target.action];
  if (!def?.undo) throw new Error(`Not reversible: ${target.action}`);

  await def.undo(targetParams);

  await db.pendingProposal.update({
    where: { id: targetProposalId },
    data: { status: "undone" },
  });
}
