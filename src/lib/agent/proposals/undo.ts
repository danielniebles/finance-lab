// Undo proposal resolver. Split out of run-agent-turn.ts
// (see docs/backlog.md god-file item).

import { db } from "@/lib/db";
import { REVERSIBLE_ACTIONS } from "../actions";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";

export async function resolveUndoLast(): Promise<ResolvedProposal> {
  // REVERSIBLE_ACTIONS is derived from PROPOSAL_ACTIONS entries that have an
  // undo function — the full propose_* tool names (ADR-026).
  const lastApproved = await db.pendingProposal.findFirst({
    where: {
      status: "approved",
      action: { in: REVERSIBLE_ACTIONS },
    },
    orderBy: { resolvedAt: "desc" },
  });

  if (!lastApproved) {
    return blockingProposal("Undo last action", "No reversible recent action found.");
  }

  const resolvedAtLabel = lastApproved.resolvedAt
    ? new Date(lastApproved.resolvedAt).toLocaleDateString("es-CO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "unknown time";

  const params: Record<string, unknown> = {
    targetProposalId: lastApproved.id,
    originalAction: lastApproved.action,
  };

  const title = `Undo: ${lastApproved.action} from ${resolvedAtLabel}`;
  const fields: { label: string; value: string }[] = [
    { label: "Reversing", value: `${lastApproved.action} from ${resolvedAtLabel}` },
    { label: "Original title", value: lastApproved.title },
  ];

  return buildResolvedProposal(params, title, fields);
}
