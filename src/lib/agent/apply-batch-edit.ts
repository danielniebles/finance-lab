// Shared "apply a batch edit" mutations for the propose_add_transactions_batch
// card (ADR-034 — credit-card screenshot ingestion). Mirrors
// apply-proposal-edit.ts's pattern (ADR-031): one small set of functions,
// each taking (proposalId, ...), reading/writing PendingProposal.params.batch,
// and returning a re-rendered ProposalDescriptor — used IDENTICALLY by both
// the Telegram bt:/be:/bs:/bc: callbacks and POST /api/proposals/batch-edit,
// so the mutation logic never forks per channel.
//
// Batch state is fully DB-resolvable (same principle as ADR-031's `editable`
// design): every mutation reads the current batch straight from
// PendingProposal.params.batch, no agent re-run needed.

import { db } from "@/lib/db";
import { buildBatchDisplay } from "./proposals/transactions-batch";
import type { BatchDescriptor, ProposalDescriptor } from "./types";

export type ApplyBatchEditResult = {
  ok: boolean;
  descriptor?: ProposalDescriptor;
  message?: string;
};

// NOTE — read-modify-write race (acknowledged, not fixed): loadPendingBatch
// (findUnique) and persistBatch (update) below form a read-modify-write pair
// with no optimistic-concurrency check (e.g. a conditional update keyed on
// updatedAt). Two near-simultaneous mutations (rapid double-tap on a
// Telegram callback, or a Telegram callback and a web edit landing close
// together) can clobber each other, last-write-wins. Deliberately left
// unguarded: this is a single-user app, the window is small, and a real fix
// needs either a schema change or meaningfully more code for a low-probability/
// low-severity case. Revisit if this ever becomes multi-user.
async function loadPendingBatch(
  proposalId: string,
): Promise<{ batch: BatchDescriptor; params: Record<string, unknown> } | { error: string }> {
  const proposal = await db.pendingProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return { error: "Proposal not found." };
  if (proposal.status !== "pending") return { error: `Proposal is already ${proposal.status}.` };

  const params = proposal.params as Record<string, unknown>;
  const batch = params.batch as BatchDescriptor | undefined;
  if (!batch) return { error: "Not a batch proposal." };

  return { batch, params };
}

async function persistBatch(
  proposalId: string,
  params: Record<string, unknown>,
  batch: BatchDescriptor,
): Promise<ProposalDescriptor> {
  const updatedParams = { ...params, batch };
  const { title, fields } = buildBatchDisplay(batch);

  await db.pendingProposal.update({
    where: { id: proposalId },
    data: {
      params: updatedParams as unknown as Record<string, string>,
      title,
    },
  });

  return {
    id: proposalId,
    action: "propose_add_transactions_batch",
    params: updatedParams,
    title,
    fields,
    reasoning: "",
    choices: [
      { id: "approve", label: "Approve", style: "primary" },
      { id: "dismiss", label: "Dismiss" },
    ],
    batch,
  };
}

/** Toggles item[idx].included. Out-of-range idx is a no-op error. */
export async function toggleBatchItem(proposalId: string, idx: number): Promise<ApplyBatchEditResult> {
  const loaded = await loadPendingBatch(proposalId);
  if ("error" in loaded) return { ok: false, message: loaded.error };

  const { batch, params } = loaded;
  if (idx < 0 || idx >= batch.items.length) {
    return { ok: false, message: `Item index out of range: ${idx}` };
  }

  const items = batch.items.map((item, i) =>
    i === idx ? { ...item, included: !item.included } : item,
  );
  const updatedBatch: BatchDescriptor = { ...batch, items };

  const descriptor = await persistBatch(proposalId, params, updatedBatch);
  return { ok: true, descriptor };
}

/** Sets item[idx].appCategoryId from batch.categoryOptions[optIdx]. */
export async function setBatchItemCategory(
  proposalId: string,
  idx: number,
  optIdx: number,
): Promise<ApplyBatchEditResult> {
  const loaded = await loadPendingBatch(proposalId);
  if ("error" in loaded) return { ok: false, message: loaded.error };

  const { batch, params } = loaded;
  if (idx < 0 || idx >= batch.items.length) {
    return { ok: false, message: `Item index out of range: ${idx}` };
  }
  const option = batch.categoryOptions[optIdx];
  if (!option) {
    return { ok: false, message: `Category option index out of range: ${optIdx}` };
  }

  const items = batch.items.map((item, i) =>
    i === idx ? { ...item, appCategoryId: option.id } : item,
  );
  const updatedBatch: BatchDescriptor = { ...batch, items };

  const descriptor = await persistBatch(proposalId, params, updatedBatch);
  return { ok: true, descriptor };
}

/**
 * Sets batch.cardLabel from batch.cardLabelOptions[optIdx] — applies to
 * EVERY included row's wallet at approve time (the executor reads
 * batch.cardLabel directly, not a per-item wallet), per the handoff's
 * explicit "wallet is the batch-level cardLabel, not the rule's wallet" rule.
 */
export async function setBatchCardLabel(
  proposalId: string,
  optIdx: number,
): Promise<ApplyBatchEditResult> {
  const loaded = await loadPendingBatch(proposalId);
  if ("error" in loaded) return { ok: false, message: loaded.error };

  const { batch, params } = loaded;
  const option = batch.cardLabelOptions[optIdx];
  if (!option) {
    return { ok: false, message: `Card label option index out of range: ${optIdx}` };
  }

  const updatedBatch: BatchDescriptor = { ...batch, cardLabel: option.label };

  const descriptor = await persistBatch(proposalId, params, updatedBatch);
  return { ok: true, descriptor };
}
