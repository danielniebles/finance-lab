// @vitest-environment node
//
// Focused tests for propose_add_transactions_batch's execute/undo (ADR-034),
// registered in PROPOSAL_ACTIONS. Verifies: only INCLUDED items are created,
// each created row uses the batch-level cardLabel as its wallet (never a
// per-item rule wallet), amount is always negated (card purchases are always
// expenses), the returned message matches the required "Added N · Total
// X · moves X to your pocket" copy, undo deletes every createdId, and — per the
// code review's Critical finding — a failure partway through the batch rolls
// back the WHOLE db.$transaction (zero rows persisted), never N-1.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/actions/vaults", () => ({
  createVault: vi.fn(), updateVault: vi.fn(), addVaultEntry: vi.fn(), archiveVault: vi.fn(),
}));
vi.mock("@/lib/actions/recurring", () => ({
  createRecurringExpense: vi.fn(), payRecurringExpense: vi.fn(),
}));
vi.mock("@/lib/actions/installments", () => ({
  createInstallment: vi.fn(), createCard: vi.fn(), markPayment: vi.fn(), unmarkPaymentBySlot: vi.fn(),
}));
vi.mock("@/lib/actions/loans", () => ({
  createDebtor: vi.fn(), createLoan: vi.fn(), recordLoanPayment: vi.fn(),
  createEntry: vi.fn(), deleteEntry: vi.fn(), createTransfer: vi.fn(), deleteTransfer: vi.fn(),
}));
vi.mock("@/lib/actions/drive", () => ({ importFromDrive: vi.fn() }));

const createTransactionMock = vi.fn();
const deleteTransactionMock = vi.fn();
vi.mock("@/lib/actions/transactions", () => ({
  createTransaction: (...args: unknown[]) => createTransactionMock(...args),
  deleteTransaction: (...args: unknown[]) => deleteTransactionMock(...args),
}));

vi.mock("@/lib/actions/counterparty-rules", () => ({
  createCounterpartyRule: vi.fn(), updateCounterpartyRule: vi.fn(), deleteCounterpartyRule: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// tx.transaction.create — the raw call executeAddTransactionsBatch makes
// inside db.$transaction (bypassing createTransaction(), per the fix for the
// Critical orphan/double-create bug). Tracks created rows in `txCreatedRows`
// so tests can assert on DB state after a simulated mid-batch failure.
let txCreatedRows: Record<string, unknown>[] = [];
let txCreateImpl: (data: Record<string, unknown>) => Promise<{ id: string }> = async (data) => {
  const id = `txn-${txCreatedRows.length + 1}`;
  txCreatedRows.push({ id, ...data });
  return { id };
};
const txCreateMock = vi.fn((args: { data: Record<string, unknown> }) => txCreateImpl(args.data));

vi.mock("@/lib/db", () => ({
  db: {
    pendingProposal: { update: vi.fn() },
    installment: { delete: vi.fn(), count: vi.fn() },
    loan: { delete: vi.fn(), count: vi.fn() },
    debtor: { delete: vi.fn() },
    loanPayment: { delete: vi.fn() },
    creditCard: { delete: vi.fn() },
    // resolveWalletId (ADR-036/037) — buildWalletResolver() prefetches these
    // once per batch; default to "no wallets/accounts" (null resolution).
    wallet: { findMany: vi.fn().mockResolvedValue([]) },
    savingsAccount: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      // Simulates Prisma's interactive-transaction rollback semantics: if the
      // callback throws, discard anything staged during this call so the
      // caller observes zero persisted rows, exactly like a real ROLLBACK.
      const before = [...txCreatedRows];
      try {
        return await cb({ transaction: { create: txCreateMock } });
      } catch (err) {
        txCreatedRows = before;
        throw err;
      }
    }),
  },
}));

import { PROPOSAL_ACTIONS } from "./actions";
import type { BatchDescriptor } from "./types";

const BATCH: BatchDescriptor = {
  cardLabel: "Visa Platino",
  categoryOptions: [{ id: "cat-going-out", label: "Going Out" }],
  cardLabelOptions: [],
  items: [
    { vendor: "Rappi", amount: 45000, date: "2026-07-01", appCategoryId: "cat-going-out", included: true },
    { vendor: "Uber", amount: 12000, appCategoryId: "cat-going-out", included: false },
    { vendor: "Netflix", amount: 30000, appCategoryId: "cat-going-out", included: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  txCreatedRows = [];
  txCreateImpl = async (data) => {
    const id = `txn-${txCreatedRows.length + 1}`;
    txCreatedRows.push({ id, ...data });
    return { id };
  };
});

describe("propose_add_transactions_batch — execute", () => {
  it("creates only INCLUDED items", async () => {
    const def = PROPOSAL_ACTIONS.propose_add_transactions_batch;
    await def.execute({ batch: BATCH }, { proposalId: "prop-1" });

    expect(txCreateMock).toHaveBeenCalledTimes(2);
  });

  it("uses the batch-level cardLabel as wallet for every created row", async () => {
    const def = PROPOSAL_ACTIONS.propose_add_transactions_batch;
    await def.execute({ batch: BATCH }, { proposalId: "prop-1" });

    for (const row of txCreatedRows) {
      expect(row.wallet).toBe("Visa Platino");
    }
  });

  it("negates the amount (card purchases are always expenses)", async () => {
    const def = PROPOSAL_ACTIONS.propose_add_transactions_batch;
    await def.execute({ batch: BATCH }, { proposalId: "prop-1" });

    expect(txCreatedRows[0].amount).toBe(-45000);
    expect(txCreatedRows[1].amount).toBe(-30000);
  });

  it("returns createdIds, count, total, and the required reply message", async () => {
    const def = PROPOSAL_ACTIONS.propose_add_transactions_batch;
    const result = await def.execute({ batch: BATCH }, { proposalId: "prop-1" });

    expect(result).toMatchObject({
      createdIds: ["txn-1", "txn-2"],
      count: 2,
      total: 75000,
    });
    expect((result as { message: string }).message).toContain("Added 2");
    expect((result as { message: string }).message).toContain("Bancolombia pocket");
  });

  it("uses the vendor as the note", async () => {
    const def = PROPOSAL_ACTIONS.propose_add_transactions_batch;
    await def.execute({ batch: BATCH }, { proposalId: "prop-1" });

    expect(txCreatedRows[0].note).toBe("Rappi");
  });

  it("rolls back the whole batch (zero rows persisted) when a create fails partway through", async () => {
    // Simulates a DB hiccup/constraint violation on the 2nd included item —
    // per the Critical review finding, this must NOT leave the 1st item's
    // row orphaned in the DB with no createdId reference anywhere.
    let calls = 0;
    txCreateImpl = async (data) => {
      calls += 1;
      if (calls === 2) throw new Error("simulated DB hiccup");
      const id = `txn-${calls}`;
      txCreatedRows.push({ id, ...data });
      return { id };
    };

    const def = PROPOSAL_ACTIONS.propose_add_transactions_batch;
    await expect(
      def.execute({ batch: BATCH }, { proposalId: "prop-1" }),
    ).rejects.toThrow("simulated DB hiccup");

    expect(txCreatedRows).toHaveLength(0);
  });
});

describe("propose_add_transactions_batch — undo", () => {
  it("deletes every id in createdIds", async () => {
    const def = PROPOSAL_ACTIONS.propose_add_transactions_batch;
    await def.undo?.({ createdIds: ["txn-1", "txn-2"] });

    expect(deleteTransactionMock).toHaveBeenCalledWith("txn-1");
    expect(deleteTransactionMock).toHaveBeenCalledWith("txn-2");
    expect(deleteTransactionMock).toHaveBeenCalledTimes(2);
  });

  it("throws when createdIds is missing", async () => {
    const def = PROPOSAL_ACTIONS.propose_add_transactions_batch;
    await expect(def.undo?.({})).rejects.toThrow();
  });
});
