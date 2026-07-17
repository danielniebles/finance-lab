// Auto-record side effect for a confident CounterpartyRule match (ADR-033).
//
// This is the scoped, deliberate exception to propose-then-confirm: when a
// bank message matches a known rule with `autoRecord: true` and the core
// fields (amount, date) parsed with confidence, the transaction is created
// immediately instead of waiting for approval. Reuses the EXISTING
// PendingProposal + undo infrastructure by creating the row already
// `status: "approved"` with a `createdId` — this is the key insight that
// makes the Telegram `↩︎ Deshacer` button work with zero new undo code (see
// execute-proposal.ts's executeUndo, which operates on any approved,
// reversible PendingProposal row regardless of how it got approved).

import { db } from "@/lib/db";
import { createTransaction } from "@/lib/actions/transactions";
import { bumpCounterpartyRuleMatch, type CounterpartyRuleRow } from "@/lib/queries/counterparty-rules";
import { getCategories } from "@/lib/queries/expenses";
import { formatCOP } from "@/lib/format";
import type { EditableField } from "./types";

const SHORTLIST_SIZE = 5; // mirrors proposals/transactions.ts's buildCategoryShortlist

export type AutoRecordResult = {
  transactionId: string;
  proposalId: string;
  message: string;
};

/**
 * Checks whether amount/date parsed with enough confidence to auto-record
 * unattended. Deliberately simple per the handoff — a sanity check, not a
 * scoring system: amount must be a finite number, date must parse to a
 * real Date.
 */
export function isConfidentTransaction(amount: number, date: string): boolean {
  if (!Number.isFinite(amount)) return false;
  const parsed = new Date(date);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Builds the same shape of category `editable` field the normal Phase 1 card
 * uses (guess first, then a handful more, then "__other__"), so the
 * auto-record notification's `✏️ Editar` button can reuse the existing
 * `eopen:0`/`e:0:{optIdx}` callback handlers verbatim — they only need
 * `PendingProposal.editable[0].options` to resolve an index to an id, they
 * don't care whether the proposal was pending or already approved.
 */
async function buildCategoryEditableField(selectedId: string): Promise<EditableField> {
  const categories = await getCategories();
  const selected = categories.find((c) => c.id === selectedId);
  const rest = categories.filter((c) => c.id !== selectedId).slice(0, SHORTLIST_SIZE - 1);
  const options = [
    ...(selected ? [{ id: selected.id, label: selected.name }] : []),
    ...rest.map((c) => ({ id: c.id, label: c.name })),
    { id: "__other__", label: "Otra…" },
  ];
  return { field: "appCategoryId", label: "Categoría", selectedId, options };
}

/**
 * Creates the transaction (category + wallet FROM THE RULE — the rule
 * overrides whatever account the message mentioned), bumps the rule's
 * matchCount/lastMatchedAt, and persists an already-"approved"
 * PendingProposal row shaped exactly like a normal propose_add_transaction
 * approval (same params shape executeAddTransaction/undoAddTransaction
 * expect, including `createdId`, plus the same `editable` shape a pending
 * card would carry) so the existing undo/edit machinery works unmodified.
 */
export async function autoRecordFromRule(args: {
  amount: number;
  date: string;
  note?: string;
  rule: CounterpartyRuleRow;
  channel: string;
}): Promise<AutoRecordResult> {
  const { amount, date, note, rule, channel } = args;

  const created = await createTransaction({
    amount,
    date: new Date(date),
    appCategoryId: rule.appCategoryId,
    wallet: rule.wallet,
    // Bypasses the collision-prone name-based resolveWalletId() whenever the
    // rule already has a resolved wallet (ADR-036/037-style upgrade) — see
    // resolve-wallet.ts's mem:agent_learnings note on Wallet names only being
    // unique per-account.
    walletId: rule.walletId ?? undefined,
    note,
  });

  await bumpCounterpartyRuleMatch(rule.id);

  const params: Record<string, unknown> = {
    amount,
    date,
    appCategoryId: rule.appCategoryId,
    wallet: rule.wallet,
    note: note ?? null,
    createdId: created.id,
    // Denormalized onto the proposal row so the Telegram delivery layer can
    // render the "Regla: ..." notification line without a second query to
    // re-derive which rule fired (a rule can be deleted/edited later; this
    // is a point-in-time record of what actually matched).
    ruleMatchType: rule.matchType,
    ruleMatchValue: rule.matchValue,
  };

  const title = `Add ${amount < 0 ? "expense" : "income"}: ${rule.wallet} — ${formatCOP(Math.abs(amount))}`;
  const editable = [await buildCategoryEditableField(rule.appCategoryId)];

  const pendingProposal = await db.pendingProposal.create({
    data: {
      action: "propose_add_transaction",
      params: params as unknown as Record<string, string>,
      title,
      channel,
      status: "approved",
      resolvedAt: new Date(),
      editable: editable as unknown as Record<string, string>,
    },
  });

  const message = `Transaction recorded automatically per your rule (${rule.matchType} "${rule.matchValue}" → ${rule.appCategoryName}).`;

  return {
    transactionId: created.id,
    proposalId: pendingProposal.id,
    message,
  };
}
