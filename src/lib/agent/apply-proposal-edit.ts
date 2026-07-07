// Shared "apply an edit" mutation for editable proposal cards (ADR-031,
// extended by ADR-033 for auto-recorded transactions).
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
//
// ADR-033 extension: a proposal created already-`"approved"` by the
// counterparty-rule auto-record path is ALSO a valid edit target — not just
// `"pending"` — as long as its action is reversible (has an undo, i.e. a
// `createdId` to act on) and that id is present. Editing this second case
// does everything the pending case does PLUS patches the already-created
// live Transaction row, since the write already happened (unlike a pending
// proposal, where editing only ever touches the draft). Kept as ONE function
// (rather than a parallel edit path) so the Telegram `✏️`/`eopen`/`e:`/`eback`
// callback handlers in route.ts need zero new branching — they already just
// call applyProposalEdit by proposalId and don't need to know which case
// they're in.

import { db } from "@/lib/db";
import { buildProposalFields } from "./formatting";
import { updateTransactionCategory } from "@/lib/actions/transactions";
import { REVERSIBLE_ACTIONS } from "./actions";
import type { EditableField, ProposalDescriptor } from "./types";

export type ApplyProposalEditResult = {
  ok: boolean;
  descriptor?: ProposalDescriptor;
  message?: string;
  /**
   * True when the edited proposal was the approved-auto-record case (ADR-033),
   * not an ordinary pending card. Callers that render the result (the Telegram
   * route's handleEditApplyCallback) use this to pick the auto-record notice
   * view (toTelegramAutoRecordMessage) instead of the generic card view
   * (toTelegramMessage) — otherwise the edit would silently downgrade the
   * message back to showing generic Approve/Dismiss buttons on an
   * already-approved transaction.
   */
  isAutoRecorded?: boolean;
};

/**
 * An auto-recorded proposal (status "approved") is a valid edit target only
 * when its action is reversible AND it carries the createdId the live-entity
 * sync step needs. Any other non-pending status (dismissed/undone, or an
 * approved-but-non-reversible action) is rejected, same as before ADR-033.
 */
function isEditableApprovedProposal(action: string, params: Record<string, unknown>): boolean {
  return REVERSIBLE_ACTIONS.includes(action) && params.createdId != null;
}

/**
 * Syncs the live entity after an edit on an already-approved proposal.
 * Today this only exists for propose_add_transaction (the only action the
 * auto-record path creates), patching the transaction's category. Extend
 * this map if a future auto-record-eligible action needs the same treatment.
 */
async function syncLiveEntityAfterEdit(
  action: string,
  field: string,
  optionId: string,
  params: Record<string, unknown>,
): Promise<void> {
  if (action === "propose_add_transaction" && field === "appCategoryId") {
    await updateTransactionCategory(params.createdId as string, optionId);
  }
}

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

  const params = proposal.params as Record<string, unknown>;
  const isApprovedAutoRecord =
    proposal.status === "approved" && isEditableApprovedProposal(proposal.action, params);

  if (proposal.status !== "pending" && !isApprovedAutoRecord) {
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
  const updatedParams = { ...params, [field]: optionId };

  await db.pendingProposal.update({
    where: { id: proposalId },
    data: {
      params: updatedParams as unknown as Record<string, string>,
      editable: updatedEditable as unknown as Record<string, string>,
    },
  });

  if (isApprovedAutoRecord) {
    await syncLiveEntityAfterEdit(proposal.action, field, optionId, params);
  }

  const descriptor: ProposalDescriptor = {
    id: proposal.id,
    action: proposal.action,
    params: updatedParams,
    title: proposal.title,
    fields: buildProposalFields(updatedParams),
    reasoning: "",
    choices: [
      { id: "approve", label: "Approve", style: "primary" },
      { id: "dismiss", label: "Dismiss" },
    ],
    editable: updatedEditable,
  };

  return { ok: true, descriptor, isAutoRecorded: isApprovedAutoRecord };
}
