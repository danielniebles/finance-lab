// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    counterpartyRule: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getCounterpartyRules, matchCounterpartyRule, bumpCounterpartyRuleMatch } from "./counterparty-rules";

const dbMock = db as unknown as {
  counterpartyRule: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCounterpartyRules", () => {
  it("orders by matchType then matchValue", async () => {
    dbMock.counterpartyRule.findMany.mockResolvedValue([]);

    await getCounterpartyRules();

    expect(dbMock.counterpartyRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ matchType: "asc" }, { matchValue: "asc" }],
      }),
    );
  });

  it("flattens the appCategory relation into appCategoryName", async () => {
    dbMock.counterpartyRule.findMany.mockResolvedValue([
      {
        id: "rule-1",
        matchType: "ACCOUNT",
        matchValue: "61793614704",
        direction: "ANY",
        appCategoryId: "cat-1",
        appCategory: { id: "cat-1", name: "Pets" },
        wallet: "Investments",
        autoRecord: true,
        recurring: false,
        expectedAmount: null,
        notes: null,
        matchCount: 3,
        lastMatchedAt: new Date("2026-07-01"),
        createdAt: new Date("2026-06-01"),
        tags: [{ id: "tag-1", name: "fruver" }],
      },
    ]);

    const rows = await getCounterpartyRules();

    expect(rows).toEqual([
      expect.objectContaining({
        id: "rule-1",
        appCategoryId: "cat-1",
        appCategoryName: "Pets",
        wallet: "Investments",
        matchCount: 3,
        tagNames: ["fruver"],
      }),
    ]);
    // appCategory relation object itself should not leak into the row shape
    expect(rows[0]).not.toHaveProperty("appCategory");
    expect(rows[0]).not.toHaveProperty("tags");
  });

  it("returns an empty array when there are no rules", async () => {
    dbMock.counterpartyRule.findMany.mockResolvedValue([]);

    const rows = await getCounterpartyRules();

    expect(rows).toEqual([]);
  });
});

const ACCOUNT_RULE = {
  id: "rule-account",
  matchType: "ACCOUNT",
  matchValue: "61793614704",
  direction: "ANY",
  appCategoryId: "cat-pets",
  appCategory: { id: "cat-pets", name: "Pets" },
  wallet: "Investments",
  autoRecord: true,
  recurring: false,
  expectedAmount: null,
  notes: null,
  matchCount: 3,
  lastMatchedAt: null,
  createdAt: new Date("2026-06-01"),
  tags: [],
};

describe("matchCounterpartyRule", () => {
  it("normalizes the account candidate before looking up", async () => {
    dbMock.counterpartyRule.findFirst.mockResolvedValue(ACCOUNT_RULE);

    const result = await matchCounterpartyRule({
      account: "617-9361 4704",
      direction: "EXPENSE",
    });

    expect(dbMock.counterpartyRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { matchType: "ACCOUNT", matchValue: "61793614704" },
      }),
    );
    expect(result?.id).toBe("rule-account");
  });

  it("tries ACCOUNT before MERCHANT before SENDER", async () => {
    dbMock.counterpartyRule.findFirst.mockResolvedValueOnce(null); // ACCOUNT miss
    dbMock.counterpartyRule.findMany.mockResolvedValueOnce([
      { ...ACCOUNT_RULE, matchType: "MERCHANT", matchValue: "RAPPI" },
    ]);

    const result = await matchCounterpartyRule({
      account: "999",
      merchant: "Rappi",
      direction: "EXPENSE",
    });

    expect(dbMock.counterpartyRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { matchType: "ACCOUNT", matchValue: "999" } }),
    );
    expect(dbMock.counterpartyRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { matchType: "MERCHANT" } }),
    );
    expect(result?.matchType).toBe("MERCHANT");
  });

  it("matches a merchant spelled with different symbols or spacing", async () => {
    dbMock.counterpartyRule.findMany.mockResolvedValue([
      { ...ACCOUNT_RULE, id: "uber", matchType: "MERCHANT", matchValue: "UBER*RIDES" },
    ]);

    const result = await matchCounterpartyRule({ merchant: "UBER RIDES", direction: "EXPENSE" });

    expect(result?.id).toBe("uber");
  });

  it("prefers an exact key, then the longest prefix rule", async () => {
    const merchant = (id: string, matchValue: string) => ({
      ...ACCOUNT_RULE,
      id,
      matchType: "MERCHANT",
      matchValue,
    });
    dbMock.counterpartyRule.findMany.mockResolvedValue([
      merchant("short", "UBER"),
      merchant("long", "UBERRIDES"),
      merchant("other", "UBER EATS"),
    ]);

    const prefix = await matchCounterpartyRule({ merchant: "UBER RIDES*DL", direction: "EXPENSE" });
    const exact = await matchCounterpartyRule({ merchant: "uber", direction: "EXPENSE" });

    expect(prefix?.id).toBe("long");
    expect(exact?.id).toBe("short");
  });

  it("skips a merchant rule whose direction conflicts and keeps looking", async () => {
    dbMock.counterpartyRule.findMany.mockResolvedValue([
      { ...ACCOUNT_RULE, id: "income-only", matchType: "MERCHANT", matchValue: "UBERRIDES", direction: "INCOME" },
      { ...ACCOUNT_RULE, id: "expense", matchType: "MERCHANT", matchValue: "UBER*RIDES", direction: "EXPENSE" },
    ]);

    const result = await matchCounterpartyRule({ merchant: "UBER RIDES", direction: "EXPENSE" });

    expect(result?.id).toBe("expense");
  });

  it("a rule with direction ANY matches both EXPENSE and INCOME", async () => {
    dbMock.counterpartyRule.findFirst.mockResolvedValue(ACCOUNT_RULE); // direction: ANY

    const expenseResult = await matchCounterpartyRule({ account: "617", direction: "EXPENSE" });
    const incomeResult = await matchCounterpartyRule({ account: "617", direction: "INCOME" });

    expect(expenseResult?.id).toBe("rule-account");
    expect(incomeResult?.id).toBe("rule-account");
  });

  it("does not match when the rule's direction conflicts with the candidate's direction", async () => {
    dbMock.counterpartyRule.findFirst.mockResolvedValue({ ...ACCOUNT_RULE, direction: "INCOME" });

    const result = await matchCounterpartyRule({ account: "617", direction: "EXPENSE" });

    expect(result).toBeNull();
  });

  it("returns null when no candidate matches any rule", async () => {
    dbMock.counterpartyRule.findFirst.mockResolvedValue(null);
    dbMock.counterpartyRule.findMany.mockResolvedValue([
      { ...ACCOUNT_RULE, matchType: "MERCHANT", matchValue: "RAPPI" },
    ]);

    const result = await matchCounterpartyRule({
      account: "000",
      merchant: "nope",
      sender: "nobody",
      direction: "EXPENSE",
    });

    expect(result).toBeNull();
  });

  it("returns null cleanly when no candidates are provided at all", async () => {
    const result = await matchCounterpartyRule({ direction: "EXPENSE" });

    expect(result).toBeNull();
    expect(dbMock.counterpartyRule.findFirst).not.toHaveBeenCalled();
    expect(dbMock.counterpartyRule.findMany).not.toHaveBeenCalled();
  });
});

describe("bumpCounterpartyRuleMatch", () => {
  it("increments matchCount and sets lastMatchedAt", async () => {
    await bumpCounterpartyRuleMatch("rule-1");

    expect(dbMock.counterpartyRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: { matchCount: { increment: 1 }, lastMatchedAt: expect.any(Date) },
    });
  });
});
