// Channel-agnostic proposal types — knows nothing about React or Telegram.

/**
 * Default reply message when an approved action's execute() doesn't opt into
 * the generic `message` escape hatch (see execute-proposal.ts). Shared
 * between execute-proposal.ts (which returns it) and action-card.tsx (which
 * checks against it to decide whether to render an extra caption under the
 * "Approved" badge) so the two can never drift independently.
 */
export const DEFAULT_APPROVE_MESSAGE = "Approved";

export type ProposalChoice = {
  id: "approve" | "dismiss";
  label: string;
  style?: "primary" | "danger";
};

export type EditableOption = { id: string; label: string };

export type EditableField = {
  field: string; // e.g. "appCategoryId" — key into params to update on edit
  label: string; // e.g. "Categoría"
  selectedId: string; // current value (the agent's guess)
  options: EditableOption[]; // shortlist, incl. synthetic "__other__" last
};

/** One extracted row inside a card-screenshot batch proposal (ADR-034). */
export type BatchItem = {
  vendor: string;
  amount: number;
  date?: string;
  appCategoryId: string; // editable per item
  included: boolean; // toggle per item
  scratchDetected?: boolean; // true when the model pre-excluded this row as crossed-out
};

/**
 * Multi-item batch shape for propose_add_transactions_batch (ADR-034 —
 * credit-card screenshot ingestion). Fully DB-resolvable: every Telegram
 * callback (bt:/be:/bs:/bc:) reads/mutates this shape from a plain
 * PendingProposal.params.batch read, no agent re-run needed — same design
 * principle as ADR-031's `editable`, but `editable`'s single-field/
 * single-selectedId shape doesn't fit "many items, each with its own
 * category id," so this lives in its own `params.batch` nest instead of
 * repurposing `editable`.
 */
export type BatchDescriptor = {
  cardLabel: string; // batch-level, editable
  items: BatchItem[];
  categoryOptions: { id: string; label: string }[]; // shared shortlist for every item's category
  cardLabelOptions: { id: string; label: string }[]; // shortlist for the cardLabel picker
};

export type ProposalDescriptor = {
  id: string; // = persisted PendingProposal.id
  action: string;
  params: Record<string, unknown>;
  title: string;
  fields: { label: string; value: string }[];
  reasoning: string;
  choices: ProposalChoice[];
  /** Fields the user can change directly on the card (e.g. category) before approving. */
  editable?: EditableField[];
  /** Present only for propose_add_transactions_batch (ADR-034). */
  batch?: BatchDescriptor;
};

/**
 * A transaction the counterparty-rule auto-record path (ADR-033) already
 * created and approved during this turn — the tool-use loop skipped the
 * normal proposal-card flow entirely. Delivery layers (deliver-to-telegram.ts)
 * use this to send the "✅ Registrado… [✏️ Editar] [↩︎ Deshacer]" notification
 * instead of (or alongside) a normal action card.
 */
export type AutoRecordedNotice = {
  proposalId: string; // = the already-approved PendingProposal.id (undo/edit target)
  transactionId: string;
};

export type AgentTurnResult = {
  text: string;
  proposals: ProposalDescriptor[];
  autoRecorded: AutoRecordedNotice[];
};
