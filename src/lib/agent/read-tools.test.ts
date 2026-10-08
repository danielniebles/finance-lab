// @vitest-environment node
//
// Advisor read tools must read data the way the rest of the app does: by
// FINANCIAL month and date range (never by ImportBatch / calendar month), and
// with the ADR-030 category resolution. See ADR-030 / ADR-054 in
// docs/decisions.md.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: { findMany: vi.fn() },
    importBatch: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/queries/installments", () => ({
  getAllInstallments: vi.fn().mockResolvedValue([]),
  getMonthSummary: vi.fn().mockResolvedValue({ totalObligation: 0 }),
}));

// Pulled in by read-tools.ts's registry but irrelevant here; mocked so import
// never reaches Google/Prisma-heavy modules.
vi.mock("@/lib/actions/drive", () => ({ listDriveFiles: vi.fn() }));

import { db } from "@/lib/db";
import { getMonthSummary } from "@/lib/queries/installments";
import { runReadTool } from "./read-tools";

const dbMock = db as unknown as {
  transaction: { findMany: ReturnType<typeof vi.fn> };
  importBatch: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
};

const GROCERIES = { id: "cat-groceries", name: "Groceries" };

function row(overrides: Record<string, unknown>) {
  return {
    id: "t1",
    date: new Date(2026, 9, 3, 12),
    amount: -20_000,
    note: null,
    wallet: "Cash",
    walletRef: null,
    appCategory: null,
    moneyLoverCategory: null,
    isTransfer: false,
    ...overrides,
  };
}

type TxResult = { transactions: Array<Record<string, unknown>> };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FINANCIAL_MONTH_START_DAY = "25";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("get_transactions", () => {
  it("scopes by the financial-month date range, never by ImportBatch", async () => {
    dbMock.transaction.findMany.mockResolvedValue([row({ appCategory: GROCERIES })]);

    const result = (await runReadTool("get_transactions", { month: 10, year: 2026 })) as TxResult;

    // Start day 25 → financial October 2026 = [Sep 25, Oct 25).
    const args = dbMock.transaction.findMany.mock.calls[0][0];
    expect(args.where.date).toEqual({ gte: new Date(2026, 8, 25), lt: new Date(2026, 9, 25) });
    expect(args.where.batchId).toBeUndefined();
    expect(args.take).toBe(201);
    expect(dbMock.importBatch.findFirst).not.toHaveBeenCalled();
    expect(result.transactions).toHaveLength(1);
  });

  it("falls back to the current financial month when month/year are missing or invalid", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 12)); // Oct 26, start day 25 → November
    dbMock.transaction.findMany.mockResolvedValue([]);

    await runReadTool("get_transactions", {});
    await runReadTool("get_transactions", { month: 13, year: 2026 });

    const nov = { gte: new Date(2026, 9, 25), lt: new Date(2026, 10, 25) };
    expect(dbMock.transaction.findMany.mock.calls[0][0].where.date).toEqual(nov);
    expect(dbMock.transaction.findMany.mock.calls[1][0].where.date).toEqual(nov);
  });

  it("caps at 200 rows and flags truncated when the month has more", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => row({ id: `t${i}` }));
    dbMock.transaction.findMany.mockResolvedValue(rows);

    const result = (await runReadTool("get_transactions", { month: 10, year: 2026 })) as TxResult & { truncated: boolean };

    expect(result.transactions).toHaveLength(200);
    expect(result.transactions[199].id).toBe("t199");
    expect(result.truncated).toBe(true);
  });

  it("is not truncated at or under the cap", async () => {
    dbMock.transaction.findMany.mockResolvedValue([row({})]);

    const result = (await runReadTool("get_transactions", { month: 10, year: 2026 })) as TxResult & { truncated: boolean };

    expect(result.truncated).toBe(false);
  });

  it("returns a MANUAL row's direct app category", async () => {
    dbMock.transaction.findMany.mockResolvedValue([row({ appCategory: GROCERIES })]);

    const result = (await runReadTool("get_transactions", { month: 10, year: 2026 })) as TxResult;

    expect(result.transactions[0]).toMatchObject({ category: "Groceries", appCategory: "Groceries", wallet: "Cash", isTransfer: false });
  });

  it("returns a MONEYLOVER row's mapped app category and its source label", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      row({ moneyLoverCategory: { name: "Food & Beverage", mapping: { appCategory: GROCERIES } }, walletRef: { name: "Nequi" } }),
    ]);

    const result = (await runReadTool("get_transactions", { month: 10, year: 2026 })) as TxResult;

    expect(result.transactions[0]).toMatchObject({ category: "Food & Beverage", appCategory: "Groceries", wallet: "Nequi" });
  });

  it("category filter matches the direct category OR (only when no direct one) the mapped category", async () => {
    dbMock.transaction.findMany.mockResolvedValue([]);

    await runReadTool("get_transactions", { month: 10, year: 2026, category: "groc" });

    const name = { contains: "groc", mode: "insensitive" };
    const { where } = dbMock.transaction.findMany.mock.calls[0][0];
    expect(where.OR).toEqual([
      { appCategory: { name } },
      { appCategoryId: null, moneyLoverCategory: { mapping: { appCategory: { name } } } },
    ]);
  });

  it("flags transfer legs so they are not counted as income/spend", async () => {
    dbMock.transaction.findMany.mockResolvedValue([row({ isTransfer: true, amount: 50_000 })]);

    const result = (await runReadTool("get_transactions", { month: 10, year: 2026 })) as TxResult;

    expect(result.transactions[0].isTransfer).toBe(true);
  });
});

describe("get_available_months", () => {
  it("includes a month that only has MANUAL transactions", async () => {
    process.env.FINANCIAL_MONTH_START_DAY = "1";
    dbMock.importBatch.findMany.mockResolvedValue([{ month: 3, year: 2026, status: "FINAL" }]);
    dbMock.transaction.findMany.mockResolvedValue([{ date: new Date(2026, 9, 3, 12) }]);

    const result = await runReadTool("get_available_months", {});

    expect(result).toEqual([
      { month: 3, year: 2026, status: "FINAL" },
      { month: 10, year: 2026 },
    ]);
  });
});

describe("get_installments", () => {
  it("uses the financial month: a date on/after the start day belongs to next month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 12)); // Oct 26, start day 25 → November

    await runReadTool("get_installments", {});

    expect(getMonthSummary).toHaveBeenCalledWith(11, 2026);
  });

  it("rolls December past the start day into January of next year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 28, 12));

    await runReadTool("get_installments", {});

    expect(getMonthSummary).toHaveBeenCalledWith(1, 2027);
  });
});
