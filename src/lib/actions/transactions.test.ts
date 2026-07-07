// @vitest-environment node
//
// Basic behavior tests for createTransaction / deleteTransaction (Part 2 —
// the bot-primary MANUAL transaction path). Mirrors run-agent-turn.test.ts's
// module-level `vi.mock("@/lib/db", ...)` convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: { create: vi.fn(), delete: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import { createTransaction, deleteTransaction, updateTransactionCategory } from "./transactions";
import { revalidatePath } from "next/cache";

const dbMock = db as unknown as {
  transaction: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
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
