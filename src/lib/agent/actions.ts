/**
 * PROPOSAL_ACTIONS — single source of truth for proposal tool → server action mapping.
 *
 * Keys are EXACT proposal tool names (propose_*). Both the producer (run-agent-turn.ts)
 * and the consumer (execute-proposal.ts) derive from this object — no string transformation
 * is needed anywhere, so the three-convention naming bug (ADR-026) cannot recur.
 *
 * Adding a new proposal tool: add one entry here; PROPOSAL_TOOLS and the executor both
 * pick it up automatically.
 */

import {
  createVault,
  updateVault,
  addVaultEntry,
  archiveVault,
} from "@/lib/actions/vaults";
import {
  createRecurringExpense,
  payRecurringExpense,
} from "@/lib/actions/recurring";
import {
  createInstallment,
  createCard,
  markPayment,
  unmarkPaymentBySlot,
} from "@/lib/actions/installments";
import {
  createDebtor,
  createLoan,
  recordLoanPayment,
  createEntry,
  deleteEntry,
  createTransfer,
  deleteTransfer,
} from "@/lib/actions/loans";
import { importFromDrive } from "@/lib/actions/drive";
import { createTransaction, deleteTransaction } from "@/lib/actions/transactions";
import {
  createCounterpartyRule,
  updateCounterpartyRule,
  deleteCounterpartyRule,
} from "@/lib/actions/counterparty-rules";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { TransactionSource } from "@/generated/prisma";
import type {
  VaultKind,
  VaultGoalType,
  BatchStatus,
  EntryType,
  RuleMatchType,
  RuleDirection,
} from "@/generated/prisma";
import type { BatchDescriptor } from "./types";
import { formatCOP } from "@/lib/format";

const CREATED_ID_MISSING_MSG = "Cannot undo: createdId not recorded.";

// ─── Registry shape ───────────────────────────────────────────────────────────

export type ProposalActionDef = {
  /**
   * Runs on approve. Receives the stored params and the proposalId (for bookkeeping).
   * Returns extra fields to merge back into params (e.g. createdId for undo) — or void.
   */
  execute: (
    params: Record<string, unknown>,
    ctx: { proposalId: string },
  ) => Promise<Record<string, unknown> | void>;
  /**
   * Optional inverse. Presence = reversible (drives undo eligibility).
   * Receives the params as stored after execute (includes createdId etc.).
   */
  undo?: (params: Record<string, unknown>) => Promise<void>;
};

// ─── Vault actions ────────────────────────────────────────────────────────────

async function executeCreateVault(
  params: Record<string, unknown>,
): Promise<void> {
  await createVault({
    name: params.name as string,
    kind: (params.kind as VaultKind | undefined) ?? "LEISURE",
    goalType: params.goalType as VaultGoalType,
    targetAmount:
      params.targetAmount != null ? Number(params.targetAmount) : null,
    targetDate:
      params.targetDate != null
        ? new Date(params.targetDate as string)
        : null,
  });
}

async function executeUpdateVault(
  params: Record<string, unknown>,
): Promise<void> {
  const { vaultId, ...fields } = params;
  await updateVault(vaultId as string, {
    name: fields.name as string | undefined,
    kind: fields.kind as VaultKind | undefined,
    goalType: fields.goalType as VaultGoalType | undefined,
    targetAmount:
      "targetAmount" in fields
        ? fields.targetAmount != null
          ? Number(fields.targetAmount)
          : null
        : undefined,
    targetDate:
      "targetDate" in fields
        ? fields.targetDate != null
          ? new Date(fields.targetDate as string)
          : null
        : undefined,
    color: fields.color as string | undefined,
    notes: fields.notes as string | undefined,
  });
}

async function executeVaultContribution(
  params: Record<string, unknown>,
): Promise<void> {
  await addVaultEntry(
    params.vaultId as string,
    Number(params.amount),
    params.date != null ? new Date(params.date as string) : undefined,
    params.notes as string | undefined,
    (params.sourceAccountId as string | undefined) ?? null,
  );
}

async function executeVaultWithdrawal(
  params: Record<string, unknown>,
): Promise<void> {
  await addVaultEntry(
    params.vaultId as string,
    -Number(params.amount),
    params.date != null ? new Date(params.date as string) : undefined,
    params.notes as string | undefined,
    (params.sourceAccountId as string | undefined) ?? null,
  );
}

async function executeArchiveVault(
  params: Record<string, unknown>,
): Promise<void> {
  await archiveVault(params.vaultId as string);
}

// ─── Recurring actions ────────────────────────────────────────────────────────

async function executeCreateRecurringExpense(
  params: Record<string, unknown>,
): Promise<void> {
  await createRecurringExpense({
    name: params.name as string,
    estimatedAmount: Number(params.estimatedAmount),
    cadenceMonths: Number(params.cadenceMonths),
    nextDueDate: new Date(params.nextDueDate as string),
    category: (params.category as string | undefined) ?? null,
    fundingVaultId: (params.fundingVaultId as string | undefined) ?? null,
  });
}

async function executePayRecurring(
  params: Record<string, unknown>,
): Promise<void> {
  await payRecurringExpense(params.id as string, {
    amount: Number(params.amount),
    fromVaultId: params.fromVaultId as string | undefined,
  });
}

// ─── Drive import action ──────────────────────────────────────────────────────

async function executeImportFromDrive(
  params: Record<string, unknown>,
): Promise<void> {
  const { fileId, fileName, status } = params as {
    fileId: string;
    fileName: string;
    status?: string;
  };
  await importFromDrive(fileId, fileName, (status as BatchStatus) ?? undefined);
}

// ─── Installment actions ──────────────────────────────────────────────────────

async function executeCreateInstallment(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const {
    createCard: newCard,
    cardId: resolvedCardId,
    ...installmentParams
  } = params;
  let cardId = resolvedCardId as string | null | undefined;
  let createdCardId: string | undefined;

  if (newCard) {
    const card = await createCard({ name: (newCard as { name: string }).name });
    cardId = card.id;
    createdCardId = card.id;
  }

  const created = await createInstallment({
    description: installmentParams.description as string,
    totalAmount: Number(installmentParams.totalAmount),
    numInstallments: Number(installmentParams.numInstallments),
    monthlyInterestRate:
      installmentParams.monthlyInterestRate != null
        ? Number(installmentParams.monthlyInterestRate)
        : null,
    startDate: new Date(installmentParams.startDate as string),
    notes: installmentParams.notes as string | undefined,
    cardId: cardId ?? null,
    debtorId: installmentParams.debtorId as string | null | undefined,
    fundingAccountId:
      installmentParams.fundingAccountId as string | null | undefined,
  });

  return {
    cardId,
    createdId: created.id,
    ...(createdCardId ? { createdCardId } : {}),
  };
}

async function undoCreateInstallment(
  params: Record<string, unknown>,
): Promise<void> {
  if (!params.createdId)
    throw new Error(CREATED_ID_MISSING_MSG);
  await db.installment.delete({ where: { id: params.createdId as string } });
  if (params.createdCardId) {
    const remaining = await db.installment.count({
      where: { cardId: params.createdCardId as string },
    });
    if (remaining === 0) {
      await db.creditCard.delete({ where: { id: params.createdCardId as string } });
    }
  }
}

async function executeMarkPayment(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await markPayment(
    params.installmentId as string,
    Number(params.installmentNum),
    params.paidAt ? new Date(params.paidAt as string) : new Date(),
  );
  return { createdId: `${params.installmentId}:${params.installmentNum}` };
}

async function undoMarkPayment(
  params: Record<string, unknown>,
): Promise<void> {
  await unmarkPaymentBySlot(
    params.installmentId as string,
    Number(params.installmentNum),
  );
}

// ─── Loan actions ─────────────────────────────────────────────────────────────

async function executeCreateLoan(
  params: Record<string, unknown>,
  ctx: { proposalId: string },
): Promise<Record<string, unknown>> {
  const {
    createDebtor: newDebtor,
    debtorId: resolvedDebtorId,
    ...loanParams
  } = params;
  let debtorId = resolvedDebtorId as string | null | undefined;

  if (newDebtor) {
    const debtor = await createDebtor({
      name: (newDebtor as { name: string }).name,
    });
    debtorId = debtor.id;
    // Store createdDebtorId for potential cascade undo
    await db.pendingProposal.update({
      where: { id: ctx.proposalId },
      data: {
        params: {
          ...params,
          debtorId,
          createdDebtorId: debtor.id,
        } as unknown as Record<string, string>,
      },
    });
  }

  const created = await createLoan({
    debtorId: debtorId as string,
    accountId: loanParams.accountId as string,
    amount: Number(loanParams.amount),
    date: new Date(loanParams.date as string),
    expectedBy: loanParams.expectedBy
      ? new Date(loanParams.expectedBy as string)
      : undefined,
    notes: loanParams.notes as string | undefined,
  });

  return { debtorId, createdId: created.id };
}

async function undoCreateLoan(
  params: Record<string, unknown>,
): Promise<void> {
  if (!params.createdId)
    throw new Error(CREATED_ID_MISSING_MSG);
  await db.loan.delete({ where: { id: params.createdId as string } });
  if (params.createdDebtorId) {
    const debtorLoanCount = await db.loan.count({
      where: { debtorId: params.createdDebtorId as string },
    });
    if (debtorLoanCount === 0) {
      await db.debtor.delete({
        where: { id: params.createdDebtorId as string },
      });
    }
  }
}

async function executeRecordLoanPayment(
  params: Record<string, unknown>,
  ctx: { proposalId: string },
): Promise<Record<string, unknown>> {
  const created = await recordLoanPayment({
    loanId: params.loanId as string,
    amount: Number(params.amount),
    date: params.date ? new Date(params.date as string) : new Date(),
    notes: params.notes as string | undefined,
  });
  // Store createdId so the proposal row has it after approve
  await db.pendingProposal.update({
    where: { id: ctx.proposalId },
    data: {
      params: {
        ...params,
        createdId: created.id,
      } as unknown as Record<string, string>,
    },
  });
  return {};
}

async function undoRecordLoanPayment(
  params: Record<string, unknown>,
): Promise<void> {
  if (!params.createdId)
    throw new Error(CREATED_ID_MISSING_MSG);
  await db.loanPayment.delete({ where: { id: params.createdId as string } });
}

// ─── Account actions ──────────────────────────────────────────────────────────

async function executeAccountAdjustment(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const created = await createEntry({
    accountId: params.accountId as string,
    type: "ADJUSTMENT" as EntryType,
    amount: Number(params.amount),
    date: new Date(params.date as string),
    notes: (params.notes as string | undefined) ?? undefined,
  });
  return { createdId: created.id };
}

async function undoAccountAdjustment(
  params: Record<string, unknown>,
): Promise<void> {
  if (!params.createdId)
    throw new Error(CREATED_ID_MISSING_MSG);
  await deleteEntry(params.createdId as string);
}

async function executeTransfer(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const created = await createTransfer({
    fromAccountId: params.fromAccountId as string,
    toAccountId: params.toAccountId as string,
    amount: Number(params.amount),
    date: new Date(params.date as string),
    notes: (params.notes as string | undefined) ?? undefined,
  });
  return { createdId: created.id };
}

async function undoTransfer(params: Record<string, unknown>): Promise<void> {
  if (!params.createdId)
    throw new Error(CREATED_ID_MISSING_MSG);
  await deleteTransfer(params.createdId as string);
}

// ─── Transaction actions ──────────────────────────────────────────────────────
// The editable card (ADR-031) may have overridden `appCategoryId` in `params`
// by the time this runs (via applyProposalEdit) — just use it directly, no
// extra resolution needed here.

async function executeAddTransaction(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const created = await createTransaction({
    amount: Number(params.amount),
    date: new Date(params.date as string),
    appCategoryId: params.appCategoryId as string,
    wallet: params.wallet as string,
    note: (params.note as string | undefined) ?? undefined,
  });
  return { createdId: created.id };
}

async function undoAddTransaction(params: Record<string, unknown>): Promise<void> {
  if (!params.createdId)
    throw new Error(CREATED_ID_MISSING_MSG);
  await deleteTransaction(params.createdId as string);
}

// ─── Transaction batch actions (ADR-034 — card-screenshot ingestion) ─────────
// Reads the batch state AS MUTATED IN params by the toggle/edit callbacks
// (bt:/be:/bs:/bc:) — NOT the original tool-call input — since the user may
// have toggled/edited items since the card was first shown. Only INCLUDED
// items are created; every included row's wallet is the batch-level
// cardLabel (never a rule's wallet — the handoff is explicit this batch flow
// differs from the single-transaction ADR-033 auto-record exception, which
// only reused the rule's wallet in a different flow, single-item, not this
// one). Returns { createdIds, count, total, message } — `message` is picked
// up by resolveProposal (execute-proposal.ts) in place of the hardcoded
// "Approved" string (a generic extension, not a batch-specific special case).

// Creates all included rows atomically via an interactive `db.$transaction`
// callback: a failure partway through (DB hiccup, constraint violation) rolls
// back EVERYTHING, so we never end up with some transactions persisted with
// no createdId reference anywhere (permanently un-undoable orphans), and a
// retry after a failure never re-creates rows that already succeeded (since
// none did). Deliberately bypasses createTransaction() here — that helper
// uses the shared `db` singleton with no way to thread an interactive
// transaction client through — and instead builds the raw
// `tx.transaction.create` calls directly, mirroring createTransaction()'s own
// data shape (MANUAL source, no batch/moneyLover linkage). The revalidation
// side effect (createTransaction()'s revalidateAll()) runs ONCE after the
// whole batch commits rather than once per item.
async function executeAddTransactionsBatch(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const batch = params.batch as BatchDescriptor;
  const included = batch.items.filter((item) => item.included);

  const createdIds = await db.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const item of included) {
      const created = await tx.transaction.create({
        data: {
          amount: -Math.abs(item.amount),
          date: item.date ? new Date(item.date) : new Date(),
          appCategoryId: item.appCategoryId,
          wallet: batch.cardLabel,
          note: item.vendor,
          source: TransactionSource.MANUAL,
          batchId: null,
          externalId: null,
          moneyLoverCategoryId: null,
        },
      });
      ids.push(created.id);
    }
    return ids;
  });

  for (const path of ["/expenses", "/overview", "/trends"] as const) {
    revalidatePath(path);
  }

  const total = included.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const message = `✅ Agregadas ${included.length} · Total ${formatCOP(total)} · mueve ${formatCOP(total)} a tu pocket de Bancolombia.`;

  return { createdIds, count: included.length, total, message };
}

async function undoAddTransactionsBatch(params: Record<string, unknown>): Promise<void> {
  const createdIds = params.createdIds as string[] | undefined;
  if (!createdIds || createdIds.length === 0)
    throw new Error(CREATED_ID_MISSING_MSG);
  for (const id of createdIds) {
    await deleteTransaction(id);
  }
}

// ─── Counterparty rule actions ────────────────────────────────────────────────

async function executeCreateCounterpartyRule(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const created = await createCounterpartyRule({
    matchType: params.matchType as RuleMatchType,
    matchValue: params.matchValue as string,
    direction: params.direction as RuleDirection | undefined,
    appCategoryId: params.appCategoryId as string,
    wallet: params.wallet as string,
    autoRecord: params.autoRecord as boolean | undefined,
    recurring: params.recurring as boolean | undefined,
    expectedAmount:
      params.expectedAmount != null ? Number(params.expectedAmount) : undefined,
    notes: (params.notes as string | undefined) ?? undefined,
  });
  return { createdId: created.id };
}

async function undoCreateCounterpartyRule(
  params: Record<string, unknown>,
): Promise<void> {
  if (!params.createdId)
    throw new Error(CREATED_ID_MISSING_MSG);
  await deleteCounterpartyRule(params.createdId as string);
}

async function executeUpdateCounterpartyRule(
  params: Record<string, unknown>,
): Promise<void> {
  const { ruleId, ...fields } = params;
  await updateCounterpartyRule(ruleId as string, {
    matchType: fields.matchType as RuleMatchType,
    matchValue: fields.matchValue as string,
    direction: fields.direction as RuleDirection | undefined,
    appCategoryId: fields.appCategoryId as string,
    wallet: fields.wallet as string,
    autoRecord: fields.autoRecord as boolean | undefined,
    recurring: fields.recurring as boolean | undefined,
    expectedAmount:
      fields.expectedAmount != null ? Number(fields.expectedAmount) : null,
    notes: (fields.notes as string | undefined) ?? null,
  });
}

async function executeDeleteCounterpartyRule(
  params: Record<string, unknown>,
): Promise<void> {
  await deleteCounterpartyRule(params.ruleId as string);
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * KEYS ARE EXACT PROPOSAL TOOL NAMES. This is the single source of truth.
 * Both run-agent-turn.ts (PROPOSAL_TOOLS derivation, PendingProposal.action storage)
 * and execute-proposal.ts (dispatch) reference this object.
 *
 * propose_undo_last is handled specially in resolveProposal (it consumes the registry
 * rather than having its own registry entry).
 */
export const PROPOSAL_ACTIONS: Record<string, ProposalActionDef> = {
  propose_create_vault: { execute: executeCreateVault },
  propose_update_vault: { execute: executeUpdateVault },
  propose_vault_contribution: { execute: executeVaultContribution },
  propose_vault_withdrawal: { execute: executeVaultWithdrawal },
  propose_archive_vault: { execute: executeArchiveVault },
  propose_create_recurring_expense: {
    execute: executeCreateRecurringExpense,
  },
  propose_pay_recurring: { execute: executePayRecurring },
  propose_import_from_drive: { execute: executeImportFromDrive },
  propose_create_installment: {
    execute: executeCreateInstallment,
    undo: undoCreateInstallment,
  },
  propose_mark_installment_paid: {
    execute: executeMarkPayment,
    undo: undoMarkPayment,
  },
  propose_create_loan: {
    execute: executeCreateLoan,
    undo: undoCreateLoan,
  },
  propose_record_loan_payment: {
    execute: executeRecordLoanPayment,
    undo: undoRecordLoanPayment,
  },
  propose_account_adjustment: {
    execute: executeAccountAdjustment,
    undo: undoAccountAdjustment,
  },
  propose_transfer: {
    execute: executeTransfer,
    undo: undoTransfer,
  },
  propose_add_transaction: {
    execute: executeAddTransaction,
    undo: undoAddTransaction,
  },
  propose_add_transactions_batch: {
    execute: executeAddTransactionsBatch,
    undo: undoAddTransactionsBatch,
  },
  propose_create_counterparty_rule: {
    execute: executeCreateCounterpartyRule,
    undo: undoCreateCounterpartyRule,
  },
  propose_update_counterparty_rule: { execute: executeUpdateCounterpartyRule },
  propose_delete_counterparty_rule: { execute: executeDeleteCounterpartyRule },
};

/**
 * Tool names that have a defined undo function.
 * Used by the propose_undo_last resolver to query eligible proposals.
 */
export const REVERSIBLE_ACTIONS: string[] = Object.entries(PROPOSAL_ACTIONS)
  .filter(([, def]) => def.undo !== undefined)
  .map(([name]) => name);
