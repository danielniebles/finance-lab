// @vitest-environment node
//
// Basic behavior tests for createTransaction / deleteTransaction (Part 2 —
// the bot-primary MANUAL transaction path). Mirrors run-agent-turn.test.ts's
// module-level `vi.mock("@/lib/db", ...)` convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
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
