// Shared shape + helpers for complex proposal resolvers. Every resolver in
// this directory follows "validate → fetch → build { params, title, fields }"
// (or bail out with a blockingMessage); this factors that shape into one
// type + two small builders instead of each domain file hand-rolling the
// return object. Split out of run-agent-turn.ts (see docs/backlog.md
// god-file item).

import type { EditableField } from "../types";

export type ProposalField = { label: string; value: string };

export type ResolvedProposal = {
  params: Record<string, unknown>;
  title: string;
  fields: ProposalField[];
  /** If set, return this as a plain text tool result instead of creating a proposal */
  blockingMessage?: string;
  /** Fields the user can change directly on the card before approving (e.g. category). */
  editable?: EditableField[];
  /**
   * Set when the resolver already performed the write itself (the
   * counterparty-rule auto-record exception, ADR-033) — the tool-use loop
   * must NOT create a normal pending proposal/action-card in this case; it
   * only returns `message` as the tool_result so the agent turn completes.
   */
  autoRecorded?: {
    transactionId: string;
    proposalId: string;
    message: string;
  };
};

/** Assemble a successful resolution — the common case for every resolver. */
export function buildResolvedProposal(
  params: Record<string, unknown>,
  title: string,
  fields: ProposalField[],
  editable?: EditableField[],
): ResolvedProposal {
  return { params, title, fields, ...(editable ? { editable } : {}) };
}

/**
 * Assemble a blocking resolution — the "validate" step failed (name not
 * found, no eligible record, etc.). `params` defaults to the raw input so
 * the tool_result echoes back what the model sent.
 */
export function blockingProposal(
  title: string,
  blockingMessage: string,
  params: Record<string, unknown> = {},
): ResolvedProposal {
  return { params, title, fields: [], blockingMessage };
}
