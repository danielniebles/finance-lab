// @vitest-environment node
//
// getTrends picks months by calendar (last n complete financial months, plus
// the running one on request) — not by ImportBatch status, which dropped
// July (left IN_PROGRESS by a partial import) and froze once imports stopped.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: { findMany: vi.fn() },
    appCategory: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getTrends } from "./trends";

const dbMock = db as unknown as {
  transaction: { findMany: ReturnType<typeof vi.fn> };
  appCategory: { findMany: ReturnType<typeof vi.fn> };
};

const tx = (date: Date, amount: number, appCategory: unknown = null, moneyLoverCategory: unknown = null) => ({
  date, amount, appCategory, moneyLoverCategory,
});
const keys = (r: Awaited<ReturnType<typeof getTrends>>) => r.months.map((m) => `${m.month}-${m.year}`);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 5, 12)); // Oct 5 2026
  process.env.FINANCIAL_MONTH_START_DAY = "1";
  dbMock.appCategory.findMany.mockResolvedValue([]);
});

afterEach(() => vi.useRealTimers());

describe("getTrends", () => {
  it("returns the last n complete months, whatever their import status", async () => {
    dbMock.transaction.findMany.mockResolvedValue([tx(new Date(2026, 3, 10), -1), tx(new Date(2026, 6, 3), -1)]);
    const result = await getTrends(6);
    expect(keys(result)).toEqual(["4-2026", "5-2026", "6-2026", "7-2026", "8-2026", "9-2026"]);
    expect(result.months.every((m) => !m.inProgress)).toBe(true);
  });

  it("appends the running month, flagged, when asked", async () => {
    dbMock.transaction.findMany.mockResolvedValue([tx(new Date(2026, 8, 10), -1)]);
    const result = await getTrends(3, { includeCurrent: true });
    expect(keys(result)).toEqual(["9-2026", "10-2026"]);
    expect(result.months.at(-1)?.inProgress).toBe(true);
  });

  it("trims leading empty months but keeps gaps in the middle", async () => {
    dbMock.transaction.findMany.mockResolvedValue([tx(new Date(2026, 6, 3), -1), tx(new Date(2026, 8, 3), -1)]);
    const result = await getTrends(6);
    expect(keys(result)).toEqual(["7-2026", "8-2026", "9-2026"]);
    expect(result.months[1].expenses).toBe(0);
  });

  it("returns empty when there is no data at all", async () => {
    dbMock.transaction.findMany.mockResolvedValue([]);
    expect(await getTrends(6)).toEqual({ months: [], categoryTrends: [] });
  });

  it("aggregates manual and imported expenses into the same month", async () => {
    const groceries = { id: "cat-groceries", name: "Groceries", budgetItems: [] };
    dbMock.transaction.findMany.mockResolvedValue([
      tx(new Date(2026, 8, 5), -10_000, groceries),
      tx(new Date(2026, 8, 6), -20_000, null, { mapping: { appCategory: groceries } }),
      tx(new Date(2026, 8, 7), 50_000),
    ]);
    dbMock.appCategory.findMany.mockResolvedValue([groceries]);
    const result = await getTrends(6);
    const sep = result.months.find((m) => m.month === 9)!;
    expect(sep.expenses).toBe(30_000);
    expect(sep.net).toBe(20_000);
    expect(result.categoryTrends[0].months.at(-1)).toBe(30_000);
  });
});
