// Complex proposal resolver dispatch. Split out of run-agent-turn.ts
// (see docs/backlog.md god-file item). Mirrors the name→handler registry
// shape actions.ts uses for PROPOSAL_ACTIONS, per backend-nextjs.md
// guidance — replaces the previous `if (toolName === ...) return resolve*()`
// chain.

import type { ResolvedProposal } from "./shared";
import { resolveImportFromDrive } from "./drive";
import { resolveCreateInstallment, resolveMarkInstallmentPaid } from "./installments";
import { resolveCreateLoan, resolveRecordLoanPayment } from "./loans";
import { resolveUndoLast } from "./undo";

export { resolveDriveFile, detectDrivePeriod, resolveImportFromDrive } from "./drive";
export { resolveCreateInstallment, resolveMarkInstallmentPaid } from "./installments";
export { resolveCreateLoan, resolveRecordLoanPayment } from "./loans";
export { resolveUndoLast } from "./undo";
export type { ResolvedProposal, ProposalField } from "./shared";

type ComplexResolver = (
  input: Record<string, unknown>,
  currentMonth: number,
  currentYear: number,
) => Promise<ResolvedProposal>;

// Each entry adapts its resolver to the shared (input, month, year) shape,
// even where a resolver ignores month/year (loans, undo) — this keeps the
// registry uniform so dispatch never needs to special-case an entry.
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
  propose_undo_last: () => resolveUndoLast(),
};

export async function resolveComplexProposal(
  toolName: string,
  input: Record<string, unknown>,
): Promise<ResolvedProposal | null> {
  // Returns null → use default simple resolution
  const resolver = RESOLVER_REGISTRY[toolName];
  if (!resolver) return null;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  return resolver(input, currentMonth, currentYear);
}
