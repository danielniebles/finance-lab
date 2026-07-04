import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PROPOSAL_ACTIONS } from "@/lib/agent/actions";

export type ProposalDecision = {
  proposalId: string;
  choiceId: "approve" | "dismiss";
};

export async function resolveProposal(
  d: ProposalDecision,
): Promise<{ ok: boolean; message: string }> {
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

    return { ok: true, message: "Approved" };
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
