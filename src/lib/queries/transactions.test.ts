// @vitest-environment node
//
// Tests for getTransactionList (ADR-035 — expenses transaction ledger).
// Mirrors expenses.test.ts's module-level `vi.mock("@/lib/db", ...)`
// convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getTransactionList, type TransactionListResult } from "./transactions";

const dbMock = db as unknown as {
  transaction: { findMany: ReturnType<typeof vi.fn> };
};

// Extracted to a top-level helper (not an inline callback) so filter tests
// don't trip max-nested-callbacks: describe > it > flatMap > map is 4 deep.
function itemIds(result: TransactionListResult): string[] {
  return result.groups.flatMap((g) => g.items.map((i) => i.id));
}

const GROCERIES = { name: "Groceries" };
const TRANSPORT = { name: "Transport" };

function txn(overrides: Record<string, unknown> = {}) {
  return {
    id: "txn-1",
    date: new Date(2026, 6, 8),
    amount: -20_000,
    wallet: "Bancolombia",
    note: "Éxito",
    source: "MONEYLOVER",
    appCategory: null,
    moneyLoverCategory: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.FINANCIAL_MONTH_START_DAY = "1";
});

describe("getTransactionList — category resolution", () => {
  it("resolves category via direct appCategoryId (MANUAL row)", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      txn({ source: "MANUAL", appCategory: GROCERIES }),
    ]);

    const result = await getTransactionList(7, 2026, "category");

    expect(result.groups[0].key).toBe("Groceries");
    expect(result.categorySummary).toEqual([{ name: "Groceries", total: -20_000, count: 1 }]);
  });

  it("resolves category via the MoneyLoverCategory mapping (MONEYLOVER row)", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      txn({ moneyLoverCategory: { mapping: { appCategory: GROCERIES } } }),
    ]);

    const result = await getTransactionList(7, 2026, "day");

    expect(result.groups[0].items[0].categoryName).toBe("Groceries");
  });

  it("leaves categoryName null when neither a direct category nor a mapping resolves", async () => {
    dbMock.transaction.findMany.mockResolvedValue([txn()]);

    const result = await getTransactionList(7, 2026, "day");

    expect(result.groups[0].items[0].categoryName).toBeNull();
  });
});

describe("getTransactionList — day grouping", () => {
  it("groups by calendar day with a correct subtotal, newest day first", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      txn({ id: "t1", date: new Date(2026, 6, 8), amount: -20_000 }),
      txn({ id: "t2", date: new Date(2026, 6, 8), amount: -5_000 }),
      txn({ id: "t3", date: new Date(2026, 6, 5), amount: -1_000 }),
    ]);

    const result = await getTransactionList(7, 2026, "day");

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].key).toBe("2026-07-08");
    expect(result.groups[0].label).toBe("Mié 8 jul");
    expect(result.groups[0].subtotal).toBe(-25_000);
    expect(result.groups[0].items).toHaveLength(2);
    expect(result.groups[1].key).toBe("2026-07-05");
  });
});

describe("getTransactionList — category/wallet grouping", () => {
  it("groups by category and sorts by |subtotal| descending", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      txn({ id: "t1", amount: -5_000, appCategory: GROCERIES }),
      txn({ id: "t2", amount: -50_000, appCategory: TRANSPORT }),
    ]);

    const result = await getTransactionList(7, 2026, "category");

    expect(result.groups.map((g) => g.key)).toEqual(["Transport", "Groceries"]);
  });

  it("buckets uncategorized transactions under a 'Sin categoría' group", async () => {
    dbMock.transaction.findMany.mockResolvedValue([txn({ appCategory: null })]);

    const result = await getTransactionList(7, 2026, "category");

    expect(result.groups[0]).toMatchObject({ key: "uncategorized", label: "Sin categoría" });
  });

  it("groups by wallet and sorts by |subtotal| descending", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      txn({ id: "t1", amount: -5_000, wallet: "Nequi" }),
      txn({ id: "t2", amount: -50_000, wallet: "Bancolombia" }),
    ]);

    const result = await getTransactionList(7, 2026, "wallet");

    expect(result.groups.map((g) => g.key)).toEqual(["Bancolombia", "Nequi"]);
  });
});

describe("getTransactionList — filters", () => {
  const FIXTURE = [
    txn({ id: "t1", amount: -20_000, wallet: "Bancolombia", note: "Groceries run", appCategory: GROCERIES }),
    txn({ id: "t2", amount: -10_000, wallet: "Nequi", note: "Uber ride", appCategory: TRANSPORT }),
    txn({ id: "t3", amount: 500_000, wallet: "Bancolombia", note: "Salary", appCategory: null }),
  ];

  beforeEach(() => {
    dbMock.transaction.findMany.mockResolvedValue(FIXTURE);
  });

  it("narrows by category name", async () => {
    const result = await getTransactionList(7, 2026, "day", { category: "Transport" });
    expect(itemIds(result)).toEqual(["t2"]);
  });

  it("narrows by exact wallet label", async () => {
    const result = await getTransactionList(7, 2026, "day", { wallet: "Nequi" });
    expect(itemIds(result)).toEqual(["t2"]);
  });

  it("narrows by type=expense (negative amounts only)", async () => {
    const result = await getTransactionList(7, 2026, "day", { type: "expense" });
    expect(itemIds(result).sort()).toEqual(["t1", "t2"]);
  });

  it("narrows by type=income (positive amounts only)", async () => {
    const result = await getTransactionList(7, 2026, "day", { type: "income" });
    expect(itemIds(result)).toEqual(["t3"]);
  });

  it("narrows by search against note, case-insensitive", async () => {
    const result = await getTransactionList(7, 2026, "day", { search: "uber" });
    expect(itemIds(result)).toEqual(["t2"]);
  });

  it("categorySummary reflects the filtered set, not the whole month", async () => {
    const result = await getTransactionList(7, 2026, "day", { wallet: "Nequi" });
    expect(result.categorySummary).toEqual([{ name: "Transport", total: -10_000, count: 1 }]);
  });

  it("monthTotalExpense/monthTotalIncome stay whole-month regardless of filters", async () => {
    const result = await getTransactionList(7, 2026, "day", { wallet: "Nequi" });
    expect(result.monthTotalExpense).toBe(30_000);
    expect(result.monthTotalIncome).toBe(500_000);
  });
});

describe("getTransactionList — date-range selection", () => {
  it("selects by date range (not batch), derived from FINANCIAL_MONTH_START_DAY", async () => {
    process.env.FINANCIAL_MONTH_START_DAY = "25";
    dbMock.transaction.findMany.mockResolvedValue([]);

    await getTransactionList(3, 2026, "day");

    const call = dbMock.transaction.findMany.mock.calls[0][0];
    expect(call.where.date.gte).toEqual(new Date(2026, 1, 25));
    expect(call.where.date.lt).toEqual(new Date(2026, 2, 25));
    expect(call.where.batch).toBeUndefined();
  });
});
