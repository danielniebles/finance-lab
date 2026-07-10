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
    walletId: null,
    walletRef: null,
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

  it("groups by walletId and labels by the joined Wallet.name, sorted by |subtotal| descending", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      txn({ id: "t1", amount: -5_000, walletId: "wlt_nequi", walletRef: { name: "Nequi" } }),
      txn({ id: "t2", amount: -50_000, walletId: "wlt_bancolombia", walletRef: { name: "Bancolombia" } }),
    ]);

    const result = await getTransactionList(7, 2026, "wallet");

    expect(result.groups.map((g) => g.key)).toEqual(["wlt_bancolombia", "wlt_nequi"]);
    expect(result.groups.map((g) => g.label)).toEqual(["Bancolombia", "Nequi"]);
  });

  it("buckets walletId: null rows under an explicit 'Sin asignar' group", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      txn({ walletId: null, walletRef: null }),
    ]);

    const result = await getTransactionList(7, 2026, "wallet");

    expect(result.groups[0]).toMatchObject({ key: "unassigned", label: "Sin asignar" });
  });
});

describe("getTransactionList — filters", () => {
  const FIXTURE = [
    txn({
      id: "t1",
      amount: -20_000,
      walletId: "wlt_bancolombia",
      walletRef: { name: "Bancolombia" },
      note: "Groceries run",
      appCategory: GROCERIES,
    }),
    txn({
      id: "t2",
      amount: -10_000,
      walletId: "wlt_nequi",
      walletRef: { name: "Nequi" },
      note: "Uber ride",
      appCategory: TRANSPORT,
    }),
    txn({
      id: "t3",
      amount: 500_000,
      walletId: "wlt_bancolombia",
      walletRef: { name: "Bancolombia" },
      note: "Salary",
      appCategory: null,
    }),
  ];

  beforeEach(() => {
    dbMock.transaction.findMany.mockResolvedValue(FIXTURE);
  });

  it("narrows by category name", async () => {
    const result = await getTransactionList(7, 2026, "day", { category: "Transport" });
    expect(itemIds(result)).toEqual(["t2"]);
  });

  it("narrows by walletId", async () => {
    const result = await getTransactionList(7, 2026, "day", { walletId: "wlt_nequi" });
    expect(itemIds(result)).toEqual(["t2"]);
  });

  it("ignores the legacy exact-label `wallet` filter (matchesWallet no longer string-matches)", async () => {
    // Regression guard for the bug this migration fixes: passing only the legacy
    // label (no walletId) must NOT narrow the list — the new Wallet.name label
    // space never matched the old MoneyLover `wallet` string anyway, so this
    // field is now inert for filtering (kept only for ledger-controls.tsx's
    // pending walletId migration, see LedgerFilters' doc comment).
    const result = await getTransactionList(7, 2026, "day", { wallet: "Nequi" });
    expect(itemIds(result).sort()).toEqual(["t1", "t2", "t3"]);
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
    const result = await getTransactionList(7, 2026, "day", { walletId: "wlt_nequi" });
    expect(result.categorySummary).toEqual([{ name: "Transport", total: -10_000, count: 1 }]);
  });

  it("monthTotalExpense/monthTotalIncome stay whole-month when walletId is not set, regardless of category/type/search", async () => {
    const resultCategory = await getTransactionList(7, 2026, "day", { category: "Transport" });
    expect(resultCategory.monthTotalExpense).toBe(30_000);
    expect(resultCategory.monthTotalIncome).toBe(500_000);

    const resultType = await getTransactionList(7, 2026, "day", { type: "expense" });
    expect(resultType.monthTotalExpense).toBe(30_000);
    expect(resultType.monthTotalIncome).toBe(500_000);

    const resultSearch = await getTransactionList(7, 2026, "day", { search: "uber" });
    expect(resultSearch.monthTotalExpense).toBe(30_000);
    expect(resultSearch.monthTotalIncome).toBe(500_000);
  });

  it("monthTotalExpense/monthTotalIncome scope to the wallet when walletId is set", async () => {
    const result = await getTransactionList(7, 2026, "day", { walletId: "wlt_nequi" });
    // Only t2 (-10_000, wlt_nequi) belongs to this wallet — t1/t3 (wlt_bancolombia) excluded.
    expect(result.monthTotalExpense).toBe(10_000);
    expect(result.monthTotalIncome).toBe(0);
  });

  it("monthTotalExpense/monthTotalIncome scope to the wallet even when combined with other filters", async () => {
    // category/type/search still don't narrow the totals — only walletId does.
    const result = await getTransactionList(7, 2026, "day", {
      walletId: "wlt_bancolombia",
      category: "Groceries",
      type: "expense",
    });
    // Both wlt_bancolombia rows (t1 expense, t3 income) count toward the totals.
    expect(result.monthTotalExpense).toBe(20_000);
    expect(result.monthTotalIncome).toBe(500_000);
  });

  it("monthTotalExpense/monthTotalIncome are 0/0 for a wallet with no transactions this month", async () => {
    const result = await getTransactionList(7, 2026, "day", { walletId: "wlt_nonexistent" });
    expect(result.monthTotalExpense).toBe(0);
    expect(result.monthTotalIncome).toBe(0);
    expect(result.groups).toEqual([]);
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
