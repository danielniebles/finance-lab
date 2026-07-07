// Complex proposal resolver dispatch. Split out of run-agent-turn.ts
// (see docs/backlog.md god-file item). Mirrors the name→handler registry
// shape actions.ts uses for PROPOSAL_ACTIONS, per backend-nextjs.md
// guidance — replaces the previous `if (toolName === ...) return resolve*()`
// chain.

import type { ResolvedProposal } from "./shared";
import { resolveImportFromDrive } from "./drive";
import { resolveCreateInstallment, resolveMarkInstallmentPaid } from "./installments";
import { resolveCreateLoan, resolveRecordLoanPayment } from "./loans";
import { resolveAccountAdjustment, resolveTransfer } from "./accounts";
import { resolveUndoLast } from "./undo";
import { resolveAddTransaction } from "./transactions";
import {
  resolveCreateCounterpartyRule,
  resolveUpdateCounterpartyRule,
  resolveDeleteCounterpartyRule,
} from "./counterparty-rules";

export { resolveDriveFile, detectDrivePeriod, resolveImportFromDrive } from "./drive";
export { resolveCreateInstallment, resolveMarkInstallmentPaid } from "./installments";
export { resolveCreateLoan, resolveRecordLoanPayment } from "./loans";
export { resolveAccountAdjustment, resolveTransfer } from "./accounts";
export { resolveUndoLast } from "./undo";
export { resolveAddTransaction } from "./transactions";
export {
  resolveCreateCounterpartyRule,
  resolveUpdateCounterpartyRule,
  resolveDeleteCounterpartyRule,
} from "./counterparty-rules";
export type { ResolvedProposal, ProposalField } from "./shared";

type ComplexResolver = (
  input: Record<string, unknown>,
  currentMonth: number,
  currentYear: number,
  channel: string,
) => Promise<ResolvedProposal>;

// Each entry adapts its resolver to the shared (input, month, year, channel)
// shape, even where a resolver ignores most of them (loans, undo) — this
// keeps the registry uniform so dispatch never needs to special-case an
// entry. `channel` was added for resolveAddTransaction's auto-record path
// (ADR-033), which needs it to persist the already-approved PendingProposal
// row with the right `channel` value — every other resolver still ignores it.
// Exported (not just module-private) so a test can assert it stays a valid
// subset of PROPOSAL_ACTIONS's keys (see run-agent-turn.test.ts) — this is
// the same drift PROPOSAL_TOOLS derivation in run-agent-turn.ts guards
// against per ADR-026, applied here to this second, hand-maintained list.
export const RESOLVER_REGISTRY: Record<string, ComplexResolver> = {
  propose_import_from_drive: (input, month, year) => resolveImportFromDrive(input, month, year),
  propose_create_installment: (input, month, year) => resolveCreateInstallment(input, month, year),
  propose_mark_installment_paid: (input, month, year) => resolveMarkInstallmentPaid(input, month, year),
  propose_create_loan: (input) => resolveCreateLoan(input),
  propose_record_loan_payment: (input) => resolveRecordLoanPayment(input),
  propose_account_adjustment: (input) => resolveAccountAdjustment(input),
  propose_transfer: (input) => resolveTransfer(input),
  propose_add_transaction: (input, _month, _year, channel) => resolveAddTransaction(input, channel),
  propose_create_counterparty_rule: (input) => resolveCreateCounterpartyRule(input),
  propose_update_counterparty_rule: (input) => resolveUpdateCounterpartyRule(input),
  propose_delete_counterparty_rule: (input) => resolveDeleteCounterpartyRule(input),
  propose_undo_last: () => resolveUndoLast(),
};

export async function resolveComplexProposal(
  toolName: string,
  input: Record<string, unknown>,
  channel = "web",
): Promise<ResolvedProposal | null> {
  // Returns null → use default simple resolution
  const resolver = RESOLVER_REGISTRY[toolName];
  if (!resolver) return null;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  return resolver(input, currentMonth, currentYear, channel);
}
