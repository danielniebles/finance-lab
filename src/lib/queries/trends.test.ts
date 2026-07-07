// @vitest-environment node
//
// Regression tests for getTrends' Part 3 refactor: it must include manual-only
// months (no ImportBatch row) in trend baselines, while still excluding
// IN_PROGRESS-only months. Mirrors run-agent-turn.test.ts's module-level
// `vi.mock("@/lib/db", ...)` convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: { findMany: vi.fn() },
    appCategory: { findMany: vi.fn() },
    importBatch: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getTrends } from "./trends";

const dbMock = db as unknown as {
  transaction: { findMany: ReturnType<typeof vi.fn> };
  appCategory: { findMany: ReturnType<typeof vi.fn> };
  importBatch: { findMany: ReturnType<typeof vi.fn> };
};

const NO_CATEGORIES: never[] = [];

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) — also drops any unconsumed
  // mockResolvedValueOnce queue left over from a test that returned early.
  vi.resetAllMocks();
  process.env.FINANCIAL_MONTH_START_DAY = "1";
  dbMock.appCategory.findMany.mockResolvedValue(NO_CATEGORIES);
});

describe("getTrends", () => {
  it("includes a manual-only month (no ImportBatch row at all)", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([
      { month: 1, year: 2026, status: "FINAL" },
    ]);
    // First findMany call (getRecentTrendMonths) looks up MANUAL dates only;
    // second call (main transaction fetch) returns the full set.
    dbMock.transaction.findMany
      .mockResolvedValueOnce([{ date: new Date(2026, 1, 10) }]) // Feb 10 manual-only
      .mockResolvedValueOnce([
        { date: new Date(2026, 1, 10), amount: -5000, appCategory: null, moneyLoverCategory: null },
      ]);

    const result = await getTrends(6);

    expect(result.months.map((m) => `${m.month}-${m.year}`)).toEqual(
      expect.arrayContaining(["1-2026", "2-2026"])
    );
  });

  it("excludes a month whose only ImportBatch is IN_PROGRESS and has no manual transactions", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([
      { month: 3, year: 2026, status: "IN_PROGRESS" },
      { month: 2, year: 2026, status: "FINAL" },
    ]);
    dbMock.transaction.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getTrends(6);

    expect(result.months.map((m) => `${m.month}-${m.year}`)).not.toContain("3-2026");
    expect(result.months.map((m) => `${m.month}-${m.year}`)).toContain("2-2026");
  });

  it("still excludes a month that has both an IN_PROGRESS batch AND manual transactions — the partial MoneyLover import taints the month's aggregate totals regardless of manual data", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([
      { month: 3, year: 2026, status: "IN_PROGRESS" },
    ]);
    dbMock.transaction.findMany
      .mockResolvedValueOnce([{ date: new Date(2026, 2, 5) }])
      .mockResolvedValueOnce([]);

    const result = await getTrends(6);
    expect(result.months.map((m) => `${m.month}-${m.year}`)).not.toContain("3-2026");
  });

  it("returns empty when there is no data at all", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([]);
    dbMock.transaction.findMany.mockResolvedValueOnce([]);

    const result = await getTrends(6);
    expect(result).toEqual({ months: [], categoryTrends: [] });
  });

  it("aggregates MANUAL and MONEYLOVER expense amounts into the same month point", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([
      { month: 3, year: 2026, status: "FINAL" },
    ]);
    const groceries = { id: "cat-groceries", name: "Groceries", budgetItems: [] };
    dbMock.transaction.findMany
      .mockResolvedValueOnce([]) // no manual-only months beyond the batch
      .mockResolvedValueOnce([
        {
          date: new Date(2026, 2, 5),
          amount: -10_000,
          appCategory: groceries,
          moneyLoverCategory: null,
        },
        {
          date: new Date(2026, 2, 6),
          amount: -20_000,
          appCategory: null,
          moneyLoverCategory: { mapping: { appCategory: groceries } },
        },
      ]);
    dbMock.appCategory.findMany.mockResolvedValue([groceries]);

    const result = await getTrends(6);

    const marchPoint = result.months.find((m) => m.month === 3 && m.year === 2026);
    expect(marchPoint?.expenses).toBe(30_000);
    expect(result.categoryTrends[0].months[0]).toBe(30_000);
  });
});
