// @vitest-environment node
//
// Regression tests for the Part 3 query refactor: getMonthlyAnalysis and
// getAvailableMonths must aggregate MANUAL + MONEYLOVER transactions by date
// range, not by ImportBatch. Mirrors run-agent-turn.test.ts's module-level
// `vi.mock("@/lib/db", ...)` convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: { findMany: vi.fn() },
    appCategory: { findMany: vi.fn() },
    importBatch: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getMonthlyAnalysis, getAvailableMonths, getCategories } from "./expenses";

const dbMock = db as unknown as {
  transaction: { findMany: ReturnType<typeof vi.fn> };
  appCategory: { findMany: ReturnType<typeof vi.fn> };
  importBatch: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

const GROCERIES = { id: "cat-groceries", name: "Groceries", budgetItems: [{ amount: 500_000, budgetType: "VARIABLE" as const }] };

beforeEach(() => {
  vi.resetAllMocks();
  process.env.FINANCIAL_MONTH_START_DAY = "1";
});

describe("getMonthlyAnalysis — MANUAL + MONEYLOVER aggregation", () => {
  it("aggregates spend from both a MANUAL transaction (direct appCategory) and a MONEYLOVER transaction (via mapping) into the same category", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      {
        amount: -20_000,
        appCategory: GROCERIES,
        moneyLoverCategory: null,
      },
      {
        amount: -30_000,
        appCategory: null,
        moneyLoverCategory: { mapping: { appCategory: GROCERIES } },
      },
    ]);
    dbMock.appCategory.findMany.mockResolvedValue([GROCERIES]);
    dbMock.importBatch.findFirst.mockResolvedValue(null);

    const result = await getMonthlyAnalysis(3, 2026);

    const groceries = result.categoryBreakdown.find((c) => c.id === "cat-groceries");
    expect(groceries?.spent).toBe(50_000);
    expect(result.totalExpenses).toBe(50_000);
    expect(result.uncategorizedCount).toBe(0);
  });

  it("degrades to today's behavior with zero MANUAL transactions (MONEYLOVER-only)", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      {
        amount: -15_000,
        appCategory: null,
        moneyLoverCategory: { mapping: { appCategory: GROCERIES } },
      },
    ]);
    dbMock.appCategory.findMany.mockResolvedValue([GROCERIES]);
    dbMock.importBatch.findFirst.mockResolvedValue({ status: "FINAL" });

    const result = await getMonthlyAnalysis(3, 2026);

    expect(result.totalExpenses).toBe(15_000);
    expect(result.isInProgress).toBe(false);
  });

  it("counts a transaction with no resolvable category as uncategorized", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      { amount: -10_000, appCategory: null, moneyLoverCategory: null },
    ]);
    dbMock.appCategory.findMany.mockResolvedValue([]);
    dbMock.importBatch.findFirst.mockResolvedValue(null);

    const result = await getMonthlyAnalysis(3, 2026);
    expect(result.uncategorizedCount).toBe(1);
  });

  it("passes a date-range filter derived from FINANCIAL_MONTH_START_DAY, not a batch filter", async () => {
    process.env.FINANCIAL_MONTH_START_DAY = "25";
    dbMock.transaction.findMany.mockResolvedValue([]);
    dbMock.appCategory.findMany.mockResolvedValue([]);
    dbMock.importBatch.findFirst.mockResolvedValue(null);

    await getMonthlyAnalysis(3, 2026);

    const call = dbMock.transaction.findMany.mock.calls[0][0];
    expect(call.where.date.gte).toEqual(new Date(2026, 1, 25));
    expect(call.where.date.lt).toEqual(new Date(2026, 2, 25));
    expect(call.where.batch).toBeUndefined();
  });
});

describe("getAvailableMonths", () => {
  it("includes a manual-only month with no ImportBatch row", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([
      { month: 2, year: 2026, status: "FINAL" },
    ]);
    dbMock.transaction.findMany.mockResolvedValue([
      { date: new Date(2026, 2, 10) }, // March 10 — no batch for March
    ]);

    const months = await getAvailableMonths();

    expect(months).toContainEqual({ month: 2, year: 2026, status: "FINAL" });
    expect(months).toContainEqual({ month: 3, year: 2026 });
  });

  it("prefers the ImportBatch status when a month has both a batch and manual transactions", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([
      { month: 3, year: 2026, status: "IN_PROGRESS" },
    ]);
    dbMock.transaction.findMany.mockResolvedValue([{ date: new Date(2026, 2, 5) }]);

    const months = await getAvailableMonths();
    expect(months).toEqual([{ month: 3, year: 2026, status: "IN_PROGRESS" }]);
  });

  it("returns months sorted ascending", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([
      { month: 1, year: 2026, status: "FINAL" },
      { month: 6, year: 2025, status: "FINAL" },
    ]);
    dbMock.transaction.findMany.mockResolvedValue([]);

    const months = await getAvailableMonths();
    expect(months).toEqual([
      { month: 6, year: 2025, status: "FINAL" },
      { month: 1, year: 2026, status: "FINAL" },
    ]);
  });
});

describe("getCategories", () => {
  it("derives budgetType from budgetItems (no stored column)", async () => {
    dbMock.appCategory.findMany.mockResolvedValue([
      GROCERIES,
      { id: "cat-rent", name: "Rent", budgetItems: [{ amount: 1_000_000, budgetType: "FIXED" }] },
      {
        id: "cat-mixed",
        name: "Mixed",
        budgetItems: [
          { amount: 100_000, budgetType: "FIXED" },
          { amount: 50_000, budgetType: "VARIABLE" },
        ],
      },
    ]);

    const categories = await getCategories();

    expect(categories.find((c) => c.id === "cat-groceries")?.budgetType).toBe("VARIABLE");
    expect(categories.find((c) => c.id === "cat-rent")?.budgetType).toBe("FIXED");
    expect(categories.find((c) => c.id === "cat-mixed")?.budgetType).toBe("MIXED");
  });
});
