// @vitest-environment node
//
// Basic behavior tests for createCounterpartyRule / updateCounterpartyRule /
// deleteCounterpartyRule. Mirrors transactions.test.ts's module-level
// `vi.mock("@/lib/db", ...)` convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

// resolveWalletFields (ADR-036/037-style upgrade) queries wallet/savingsAccount
// on every create/update call when only a free-text `wallet` label is given —
// mocked here to resolve to "no match" (null) by default so these tests don't
// need to know about wallets. The actual walletId-bypass/name-resolution logic
// is covered separately below and in src/lib/resolve-wallet.test.ts.
vi.mock("@/lib/db", () => ({
  db: {
    counterpartyRule: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    wallet: { findMany: vi.fn().mockResolvedValue([]), findUniqueOrThrow: vi.fn() },
    savingsAccount: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import {
  createCounterpartyRule,
  updateCounterpartyRule,
  deleteCounterpartyRule,
} from "./counterparty-rules";
import { revalidatePath } from "next/cache";

const dbMock = db as unknown as {
  counterpartyRule: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  wallet: {
    findMany: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCounterpartyRule", () => {
  it("normalizes an ACCOUNT matchValue to digits-only before writing", async () => {
    dbMock.counterpartyRule.create.mockResolvedValue({ id: "rule-1" });

    await createCounterpartyRule({
      matchType: "ACCOUNT",
      matchValue: "617-9361 4704",
      appCategoryId: "cat-1",
      wallet: "Investments",
    });

    expect(dbMock.counterpartyRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchType: "ACCOUNT",
        matchValue: "61793614704",
        appCategoryId: "cat-1",
        wallet: "Investments",
      }),
    });
  });

  it("normalizes a MERCHANT matchValue to trimmed+uppercase before writing", async () => {
    dbMock.counterpartyRule.create.mockResolvedValue({ id: "rule-1" });

    await createCounterpartyRule({
      matchType: "MERCHANT",
      matchValue: "  rappi  ",
      appCategoryId: "cat-1",
      wallet: "Bancolombia",
    });

    expect(dbMock.counterpartyRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchType: "MERCHANT",
        matchValue: "RAPPI",
      }),
    });
  });

  it("revalidates /settings/rules", async () => {
    dbMock.counterpartyRule.create.mockResolvedValue({ id: "rule-1" });

    await createCounterpartyRule({
      matchType: "SENDER",
      matchValue: "Juan",
      appCategoryId: "cat-1",
      wallet: "W",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/settings/rules");
  });

  it("returns the created row", async () => {
    const created = { id: "rule-1" };
    dbMock.counterpartyRule.create.mockResolvedValue(created);

    const result = await createCounterpartyRule({
      matchType: "KEYWORD",
      matchValue: "netflix",
      appCategoryId: "cat-1",
      wallet: "W",
    });

    expect(result).toBe(created);
  });

  it("resolves an explicitly supplied walletId's name and writes both columns, bypassing name-based resolution", async () => {
    dbMock.counterpartyRule.create.mockResolvedValue({ id: "rule-1" });
    dbMock.wallet.findUniqueOrThrow.mockResolvedValue({ name: "Nequi" });

    await createCounterpartyRule({
      matchType: "MERCHANT",
      matchValue: "Rappi",
      appCategoryId: "cat-1",
      wallet: "stale label",
      walletId: "wallet-1",
    });

    expect(dbMock.wallet.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      select: { name: true },
    });
    expect(db.wallet.findMany).not.toHaveBeenCalled();
    expect(dbMock.counterpartyRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ walletId: "wallet-1", wallet: "Nequi" }),
    });
  });

  it("falls back to name-based resolveWalletId() when only the free-text wallet label is supplied", async () => {
    dbMock.counterpartyRule.create.mockResolvedValue({ id: "rule-1" });

    await createCounterpartyRule({
      matchType: "MERCHANT",
      matchValue: "Rappi",
      appCategoryId: "cat-1",
      wallet: "Bancolombia",
    });

    expect(db.wallet.findMany).toHaveBeenCalled();
    expect(dbMock.wallet.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(dbMock.counterpartyRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ wallet: "Bancolombia", walletId: null }),
    });
  });
});

describe("updateCounterpartyRule", () => {
  it("re-normalizes matchValue on update", async () => {
    dbMock.counterpartyRule.update.mockResolvedValue({ id: "rule-1" });

    await updateCounterpartyRule("rule-1", {
      matchType: "ACCOUNT",
      matchValue: "cuenta 6179361-4704",
      appCategoryId: "cat-2",
      wallet: "Investments",
    });

    expect(dbMock.counterpartyRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: expect.objectContaining({
        matchValue: "61793614704",
        appCategoryId: "cat-2",
      }),
    });
  });

  it("revalidates /settings/rules", async () => {
    dbMock.counterpartyRule.update.mockResolvedValue({ id: "rule-1" });

    await updateCounterpartyRule("rule-1", {
      matchType: "MERCHANT",
      matchValue: "rappi",
      appCategoryId: "cat-1",
      wallet: "W",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/settings/rules");
  });

  it("prefers walletId over wallet when both are supplied in the same call", async () => {
    dbMock.counterpartyRule.update.mockResolvedValue({ id: "rule-1" });
    dbMock.wallet.findUniqueOrThrow.mockResolvedValue({ name: "Savings" });

    await updateCounterpartyRule("rule-1", {
      matchType: "ACCOUNT",
      matchValue: "6179361-4704",
      appCategoryId: "cat-2",
      wallet: "stale label",
      walletId: "wallet-2",
    });

    expect(db.wallet.findMany).not.toHaveBeenCalled();
    expect(dbMock.counterpartyRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: expect.objectContaining({ walletId: "wallet-2", wallet: "Savings" }),
    });
  });
});

describe("deleteCounterpartyRule", () => {
  it("deletes the rule by id and revalidates", async () => {
    await deleteCounterpartyRule("rule-1");

    expect(dbMock.counterpartyRule.delete).toHaveBeenCalledWith({ where: { id: "rule-1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/rules");
  });
});
