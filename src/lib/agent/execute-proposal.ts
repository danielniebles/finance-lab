import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PROPOSAL_ACTIONS } from "@/lib/agent/actions";

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

/**
 * Builds the "remember this?" nudge text when an approved transaction had an
 * extractable counterparty but matched no existing rule. Only fires on the
 * genuinely-unmatched case (`hadCounterpartyMatch === false`), not merely
 * "wasn't auto-recorded" — a match with autoRecord:false already has a rule,
 * there's nothing to learn.
 */
function buildLearnRuleNudge(action: string, params: Record<string, unknown>): string | undefined {
  if (action !== "propose_add_transaction" || params.hadCounterpartyMatch !== false) {
    return undefined;
  }
  const counterparty =
    (params.counterpartyAccount as string | undefined) ??
    (params.counterpartyMerchant as string | undefined) ??
    (params.counterpartySender as string | undefined);
  if (!counterparty) return undefined;

  return `💡 ¿Quieres que recuerde esto? La próxima transacción a/de "${counterparty}" se registraría automáticamente con la misma categoría y wallet. Dime "sí, recuérdalo" si quieres crear la regla.`;
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
    if (proposal.action === "propose_undo_last") {
      await executeUndo(params);
    } else {
      const def = PROPOSAL_ACTIONS[proposal.action];
      if (!def) throw new Error(`No handler for action: ${proposal.action}`);
      const extra = await def.execute(params, { proposalId });
      if (extra && Object.keys(extra).length > 0) {
        await db.pendingProposal.update({
          where: { id: proposalId },
          data: {
            params: { ...params, ...extra } as unknown as Record<
              string,
              string
            >,
          },
        });
      }
    }

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
      message: "Approved",
      learnRuleNudge: buildLearnRuleNudge(proposal.action, params),
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
