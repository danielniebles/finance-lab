// @vitest-environment node
//
// Regression test for getFinancialSnapshot's Part 3 fix: the per-month loop
// must source "recent months" from getAvailableMonths (manual + imported
// union), not from a raw ImportBatch query — so a manual-only month appears
// in the snapshot even with zero ImportBatch rows.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: { findMany: vi.fn() },
    appCategory: { findMany: vi.fn() },
    importBatch: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("./loans", () => ({
  getLoansOverview: vi.fn().mockResolvedValue({
    accounts: [],
    debtors: [],
    available: 0,
    inLoans: 0,
    totalSavings: 0,
    liquidityRatio: null,
    totalEverLent: 0,
    totalRecovered: 0,
    inVaults: 0,
    netWorth: 0,
  }),
}));

vi.mock("./installments", () => ({
  getAllInstallments: vi.fn().mockResolvedValue([]),
}));

import { db } from "@/lib/db";
import { getFinancialSnapshot } from "./chat";

const dbMock = db as unknown as {
  transaction: { findMany: ReturnType<typeof vi.fn> };
  appCategory: { findMany: ReturnType<typeof vi.fn> };
  importBatch: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FINANCIAL_MONTH_START_DAY = "1";
  dbMock.appCategory.findMany.mockResolvedValue([]);
  dbMock.importBatch.findFirst.mockResolvedValue(null);
});

describe("getFinancialSnapshot", () => {
  it("includes a manual-only month (no ImportBatch row) in the expenses section", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([]); // no batches at all
    dbMock.transaction.findMany.mockResolvedValue([
      // getAvailableMonths' MANUAL lookup, then getMonthlyAnalysis' date-range lookup
      { date: new Date(), amount: -5000, appCategory: null, moneyLoverCategory: null },
    ]);

    const snapshot = await getFinancialSnapshot();

    expect(snapshot).toContain("## Expenses");
    expect(snapshot).not.toContain("No expense data imported yet.");
  });

  it("falls back to 'no expense data' when there are no months at all", async () => {
    dbMock.importBatch.findMany.mockResolvedValue([]);
    dbMock.transaction.findMany.mockResolvedValue([]);

    const snapshot = await getFinancialSnapshot();
    expect(snapshot).toContain("No expense data imported yet.");
  });
});
