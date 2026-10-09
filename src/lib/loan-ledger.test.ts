// @vitest-environment node
//
// Loan ↔ Transaction link helpers (ADR-060). They take the caller's `tx`
// client, so a hand-built fake stands in for it — no module-level db mock.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRepayments, removeLoan, shrinkTransaction, type TransactionClient } from "./loan-ledger";

function fakeTx() {
  let nextId = 0;
  return {
    appCategory: { upsert: vi.fn().mockResolvedValue({ id: "cat-loans" }) },
    wallet: { findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({ name: `wallet ${where.id}` })) },
    savingsAccount: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "Nu", savingsWallet: { id: "w-nu", name: "Nu savings" } }),
    },
    transaction: {
      create: vi.fn(async () => ({ id: `tx-${++nextId}` })),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    loan: { findUniqueOrThrow: vi.fn(), delete: vi.fn() },
    installmentPayment: { deleteMany: vi.fn() },
    loanPayment: { create: vi.fn(async ({ data }: { data: object }) => ({ id: `p-${++nextId}`, ...data })) },
  };
}

let tx: ReturnType<typeof fakeTx>;
const asTx = () => tx as unknown as TransactionClient;

beforeEach(() => {
  tx = fakeTx();
});

describe("createRepayments", () => {
  it("one incoming transfer transaction per wallet, linked to every payment in it", async () => {
    await createRepayments(asTx(), {
      debtorName: "Javier",
      date: new Date("2026-11-01T12:00:00"),
      splits: [
        { loanId: "l1", walletId: "w-savings", accountId: "a1", amount: 100_000 },
        { loanId: "l2", walletId: "w-savings", accountId: "a1", amount: 50_000 },
        { loanId: "l3", walletId: null, accountId: "a2", amount: 20_000 },
      ],
    });

    expect(tx.transaction.create).toHaveBeenCalledTimes(2);
    const [first, second] = tx.transaction.create.mock.calls.map((c) => (c as unknown as [{ data: Record<string, unknown> }])[0].data);
    expect(first).toMatchObject({ amount: 150_000, walletId: "w-savings", isTransfer: true, appCategoryId: "cat-loans", note: "Repayment from Javier" });
    // A legacy loan with no wallet: the money lands on its account's savings wallet.
    expect(second).toMatchObject({ amount: 20_000, walletId: "w-nu", wallet: "Nu savings" });
    const linked = tx.loanPayment.create.mock.calls.map((c) => (c as unknown as [{ data: { loanId: string; transactionId: string } }])[0].data);
    expect(linked.map((p) => [p.loanId, p.transactionId])).toEqual([["l1", "tx-1"], ["l2", "tx-1"], ["l3", "tx-4"]]);
  });
});

describe("shrinkTransaction", () => {
  it("takes the share out of the transaction", async () => {
    tx.transaction.findUnique.mockResolvedValue({ amount: 150_000 });
    await shrinkTransaction(asTx(), "tx-1", 50_000);
    expect(tx.transaction.update).toHaveBeenCalledWith({ where: { id: "tx-1" }, data: { amount: 100_000 } });
  });

  it("deletes it once nothing is left (outgoing, negative share)", async () => {
    tx.transaction.findUnique.mockResolvedValue({ amount: -172_260 });
    await shrinkTransaction(asTx(), "tx-1", -172_260);
    expect(tx.transaction.delete).toHaveBeenCalledWith({ where: { id: "tx-1" } });
  });
});

describe("removeLoan", () => {
  beforeEach(() => {
    tx.loan.findUniqueOrThrow.mockResolvedValue({
      transactionId: "tx-out",
      payments: [{ amount: 40_000, transactionId: "tx-in" }],
    });
    tx.transaction.findUnique.mockResolvedValue({ amount: 100_000 });
  });

  it("a mistake: deletes the outgoing transaction and unmarks its slots", async () => {
    await removeLoan(asTx(), "l1", { keepOutgoing: false, keepRepayments: true, unmarkSlots: true });
    expect(tx.installmentPayment.deleteMany).toHaveBeenCalledWith({ where: { loanId: "l1" } });
    expect(tx.transaction.delete).toHaveBeenCalledWith({ where: { id: "tx-out" } });
    // Repayments already received stay in the balance by default.
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it("deleting repayments too takes each one's share out of its incoming transaction", async () => {
    await removeLoan(asTx(), "l1", { keepOutgoing: false, keepRepayments: false, unmarkSlots: true });
    expect(tx.loan.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
    expect(tx.transaction.delete).toHaveBeenCalledWith({ where: { id: "tx-out" } });
    expect(tx.transaction.update).toHaveBeenCalledWith({ where: { id: "tx-in" }, data: { amount: 60_000 } });
  });

  it("a forgiven debt keeps the money moved and the slots paid; only the loan goes", async () => {
    await removeLoan(asTx(), "l1", { keepOutgoing: true, keepRepayments: true, unmarkSlots: false });
    expect(tx.loan.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
    expect(tx.installmentPayment.deleteMany).not.toHaveBeenCalled();
    expect(tx.transaction.delete).not.toHaveBeenCalled();
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });
});
