// Shared "apply an edit" mutation for editable proposal cards (ADR-031).
//
// Both Telegram (button tap) and web (dropdown change) need to: given a
// proposalId and a selected option, update PendingProposal.params[field] AND
// PendingProposal.editable[fieldIndex].selectedId, then return enough to
// re-render the card. One function, genuinely shared — not duplicated between
// the Telegram callback handler and the /api/proposals/edit route.
//
// Re-render strategy: `title` is reused as-is (PendingProposal.title is
// persisted at creation time and never depends on the edited value for any
// editable field that exists today — see proposals/transactions.ts, where the
// title is built from amount/wallet only). `fields` are NOT persisted on
// PendingProposal at all (only params/title are), so they're rebuilt via the
// generic buildProposalFields(params) formatter rather than re-invoking the
// domain resolver — cheaper than a full re-resolve, and correct because the
// edited field (category) is deliberately excluded from `fields` and shown
// only through `editable` (formatting.ts's skipKeys includes appCategoryId).
// If a future editable field needs to affect title/fields text, revisit this
// choice rather than adding unused regeneration machinery now.

import { db } from "@/lib/db";
import { buildProposalFields } from "./formatting";
import type { EditableField, ProposalDescriptor } from "./types";

export type ApplyProposalEditResult = {
  ok: boolean;
  descriptor?: ProposalDescriptor;
  message?: string;
};

export async function applyProposalEdit(
  proposalId: string,
  field: string,
  optionId: string,
): Promise<ApplyProposalEditResult> {
  // "__other__" is a synthetic sentinel (see proposals/transactions.ts) meant
  // to trigger a free-text prompt in the calling channel, never a real value
  // to persist. Callers (Telegram route) special-case it before reaching
  // here; guard again so a direct web/API caller can't accidentally store it.
  if (optionId === "__other__") {
    return { ok: false, message: "\"__other__\" must be handled as a free-text prompt, not applied directly." };
  }

  const proposal = await db.pendingProposal.findUnique({ where: { id: proposalId } });

  if (!proposal) {
    return { ok: false, message: "Proposal not found." };
  }
  if (proposal.status !== "pending") {
    return { ok: false, message: `Proposal is already ${proposal.status}.` };
  }

  const editable = (proposal.editable as unknown as EditableField[] | null) ?? [];
  const fieldIdx = editable.findIndex((e) => e.field === field);
  if (fieldIdx === -1) {
    return { ok: false, message: `Unknown editable field: ${field}` };
  }

  const option = editable[fieldIdx].options.find((o) => o.id === optionId);
  if (!option) {
    return { ok: false, message: `Unknown option: ${optionId}` };
  }

  const updatedEditable = editable.map((e, i) =>
    i === fieldIdx ? { ...e, selectedId: optionId } : e,
  );
  const params = { ...(proposal.params as Record<string, unknown>), [field]: optionId };

  await db.pendingProposal.update({
    where: { id: proposalId },
    data: {
      params: params as unknown as Record<string, string>,
      editable: updatedEditable as unknown as Record<string, string>,
    },
  });

  const descriptor: ProposalDescriptor = {
    id: proposal.id,
    action: proposal.action,
    params,
    title: proposal.title,
    fields: buildProposalFields(params),
    reasoning: "",
    choices: [
      { id: "approve", label: "Approve", style: "primary" },
      { id: "dismiss", label: "Dismiss" },
    ],
    editable: updatedEditable,
  };

  return { ok: true, descriptor };
}
