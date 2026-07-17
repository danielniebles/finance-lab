// @vitest-environment node
//
// Basic behavior tests for createTransaction / deleteTransaction (Part 2 —
// the bot-primary MANUAL transaction path). Mirrors run-agent-turn.test.ts's
// module-level `vi.mock("@/lib/db", ...)` convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

// resolveWalletId (ADR-036/037) queries wallet + savingsAccount on every
// createTransaction/updateTransaction call — mocked here to resolve to "no
// match" (null) by default so these tests don't need to know about wallets.
// The actual name-match/fallback/precedence logic is covered separately in
// src/lib/resolve-wallet.test.ts.
vi.mock("@/lib/db", () => ({
  db: {
    transaction: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    wallet: { findMany: vi.fn().mockResolvedValue([]), findUniqueOrThrow: vi.fn() },
    savingsAccount: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import {
  createTransaction,
  deleteTransaction,
  updateTransactionCategory,
  updateTransaction,
} from "./transactions";
import { revalidatePath } from "next/cache";

const dbMock = db as unknown as {
  transaction: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  wallet: {
    findMany: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTransaction", () => {
  it("creates a MANUAL row with batch/externalId/moneyLoverCategoryId null", async () => {
    dbMock.transaction.create.mockResolvedValue({ id: "txn-1" });

    await createTransaction({
      amount: -11_956,
      date: new Date(2026, 2, 10),
      appCategoryId: "cat-1",
      wallet: "Bancolombia",
      note: "Uber",
    });

    expect(dbMock.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -11_956,
        appCategoryId: "cat-1",
        wallet: "Bancolombia",
        note: "Uber",
        source: "MANUAL",
        batchId: null,
        externalId: null,
        moneyLoverCategoryId: null,
      }),
    });
  });

  it("revalidates /expenses, /overview, and /trends", async () => {
    dbMock.transaction.create.mockResolvedValue({ id: "txn-1" });

    await createTransaction({
      amount: -1000,
      date: new Date(),
      appCategoryId: "cat-1",
      wallet: "W",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/expenses");
    expect(revalidatePath).toHaveBeenCalledWith("/overview");
    expect(revalidatePath).toHaveBeenCalledWith("/trends");
  });

  it("returns the created row", async () => {
    const created = { id: "txn-1", amount: -1000 };
    dbMock.transaction.create.mockResolvedValue(created);

    const result = await createTransaction({
      amount: -1000,
      date: new Date(),
      appCategoryId: "cat-1",
      wallet: "W",
    });

    expect(result).toBe(created);
  });

  it("uses an explicitly supplied walletId as-is, bypassing name-based resolution", async () => {
    dbMock.transaction.create.mockResolvedValue({ id: "txn-1" });

    await createTransaction({
      amount: -1000,
      date: new Date(2026, 2, 10),
      appCategoryId: "cat-1",
      wallet: "Savings",
      walletId: "wallet-explicit-id",
      note: "Curated dropdown pick",
    });

    // resolveWalletId would prefetch via db.wallet.findMany/db.savingsAccount.findMany —
    // asserting those weren't called proves the name-based path was skipped entirely.
    expect(db.wallet.findMany).not.toHaveBeenCalled();
    expect(db.savingsAccount.findMany).not.toHaveBeenCalled();

    expect(dbMock.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        wallet: "Savings",
        walletId: "wallet-explicit-id",
      }),
    });
  });
});

describe("deleteTransaction", () => {
  it("deletes the transaction by id and revalidates", async () => {
    await deleteTransaction("txn-1");

    expect(dbMock.transaction.delete).toHaveBeenCalledWith({ where: { id: "txn-1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/expenses");
    expect(revalidatePath).toHaveBeenCalledWith("/overview");
    expect(revalidatePath).toHaveBeenCalledWith("/trends");
  });
});

describe("updateTransactionCategory", () => {
  it("patches only appCategoryId on the given transaction", async () => {
    await updateTransactionCategory("txn-1", "cat-2");

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { appCategoryId: "cat-2" },
    });
  });

  it("revalidates /expenses, /overview, and /trends", async () => {
    await updateTransactionCategory("txn-1", "cat-2");

    expect(revalidatePath).toHaveBeenCalledWith("/expenses");
    expect(revalidatePath).toHaveBeenCalledWith("/overview");
    expect(revalidatePath).toHaveBeenCalledWith("/trends");
  });
});

describe("updateTransaction", () => {
  it("edits a MANUAL row in place with no source flip", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MANUAL",
      appCategoryId: "cat-1",
      moneyLoverCategory: null,
    });

    await updateTransaction("txn-1", { amount: -5000, note: "Corrected" });

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { amount: -5000, note: "Corrected" },
    });
  });

  it("detaches a MONEYLOVER row: flips source, nulls batchId/moneyLoverCategoryId", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MONEYLOVER",
      appCategoryId: null,
      moneyLoverCategory: { mapping: { appCategoryId: "cat-mapped" } },
    });

    await updateTransaction("txn-1", { amount: -5000 });

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: {
        amount: -5000,
        source: "MANUAL",
        batchId: null,
        moneyLoverCategoryId: null,
        appCategoryId: "cat-mapped",
      },
    });
  });

  it("prefers an explicitly supplied appCategoryId over the resolved fallback when detaching", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MONEYLOVER",
      appCategoryId: null,
      moneyLoverCategory: { mapping: { appCategoryId: "cat-mapped" } },
    });

    await updateTransaction("txn-1", { appCategoryId: "cat-explicit" });

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: expect.objectContaining({ appCategoryId: "cat-explicit" }),
    });
  });

  it("keeps the row's existing direct appCategoryId when detaching and no new one is supplied", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MONEYLOVER",
      appCategoryId: "cat-direct",
      moneyLoverCategory: { mapping: { appCategoryId: "cat-mapped" } },
    });

    await updateTransaction("txn-1", { wallet: "Nequi" });

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: expect.objectContaining({ appCategoryId: "cat-direct" }),
    });
  });

  it("clears the category on a MANUAL row when appCategoryId is explicitly null", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MANUAL",
      appCategoryId: "cat-1",
      moneyLoverCategory: null,
    });

    await updateTransaction("txn-1", { appCategoryId: null });

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { appCategoryId: null },
    });
  });

  it("clears the category on a detaching MONEYLOVER row when appCategoryId is explicitly null, without the fallback overriding it", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MONEYLOVER",
      appCategoryId: "cat-direct",
      moneyLoverCategory: { mapping: { appCategoryId: "cat-would-map-to" } },
    });

    await updateTransaction("txn-1", { appCategoryId: null });

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: expect.objectContaining({ appCategoryId: null }),
    });
  });

  it("clears the note on a MANUAL row when note is explicitly null", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MANUAL",
      appCategoryId: "cat-1",
      moneyLoverCategory: null,
    });

    await updateTransaction("txn-1", { note: null });

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { note: null },
    });
  });

  it("detaches to a null appCategoryId when neither a direct category nor a mapping resolves", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MONEYLOVER",
      appCategoryId: null,
      moneyLoverCategory: null,
    });

    await updateTransaction("txn-1", { note: "Uncategorized import row" });

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: expect.objectContaining({ appCategoryId: null }),
    });
  });

  it("revalidates /expenses, /overview, and /trends", async () => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MANUAL",
      appCategoryId: "cat-1",
      moneyLoverCategory: null,
    });

    await updateTransaction("txn-1", { note: "x" });

    expect(revalidatePath).toHaveBeenCalledWith("/expenses");
    expect(revalidatePath).toHaveBeenCalledWith("/overview");
    expect(revalidatePath).toHaveBeenCalledWith("/trends");
  });
});

// ADR-036/037 fix: a caller-supplied walletId must still keep the legacy
// `wallet` text column in sync, so every raw reader of that column (the
// agent's read-tools.ts, LedgerItem.wallet) stays correct after an edit
// made through the Select (which only ever has the id, never the label).
// Kept as a sibling top-level describe (not nested inside "updateTransaction")
// so the outer describe's callback stays under max-lines-per-function.
describe("updateTransaction — walletId bypass keeps the legacy wallet column in sync", () => {
  beforeEach(() => {
    dbMock.transaction.findUniqueOrThrow.mockResolvedValue({
      source: "MANUAL",
      appCategoryId: "cat-1",
      moneyLoverCategory: null,
    });
  });

  it("resolves the wallet name and sets both walletId and wallet, without calling resolveWalletId()", async () => {
    dbMock.wallet.findUniqueOrThrow.mockResolvedValue({ name: "Nequi" });

    await updateTransaction("txn-1", { walletId: "wallet-2" });

    expect(dbMock.wallet.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "wallet-2" },
      select: { name: true },
    });
    // resolveWalletId() would prefetch via db.wallet.findMany/db.savingsAccount.findMany —
    // asserting those weren't called proves name-based resolution was skipped entirely.
    expect(db.wallet.findMany).not.toHaveBeenCalled();
    expect(db.savingsAccount.findMany).not.toHaveBeenCalled();

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: expect.objectContaining({ walletId: "wallet-2", wallet: "Nequi" }),
    });
  });

  it("still resolves via resolveWalletId() when only the free-text wallet label is supplied", async () => {
    await updateTransaction("txn-1", { wallet: "Bancolombia" });

    expect(db.wallet.findMany).toHaveBeenCalled();
    expect(db.savingsAccount.findMany).toHaveBeenCalled();
    expect(dbMock.wallet.findUniqueOrThrow).not.toHaveBeenCalled();

    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: expect.objectContaining({ wallet: "Bancolombia", walletId: null }),
    });
  });

  it("prefers walletId over wallet when both are supplied in the same call", async () => {
    dbMock.wallet.findUniqueOrThrow.mockResolvedValue({ name: "Savings" });

    await updateTransaction("txn-1", { wallet: "stale label", walletId: "wallet-3" });

    expect(db.wallet.findMany).not.toHaveBeenCalled();
    expect(dbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: expect.objectContaining({ walletId: "wallet-3", wallet: "Savings" }),
    });
  });

  it("leaves both wallet and walletId untouched when neither is supplied", async () => {
    await updateTransaction("txn-1", { note: "no wallet change" });

    expect(dbMock.wallet.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(db.wallet.findMany).not.toHaveBeenCalled();

    const call = dbMock.transaction.update.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("wallet");
    expect(call.data).not.toHaveProperty("walletId");
  });
});
