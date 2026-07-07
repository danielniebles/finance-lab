// @vitest-environment node
//
// Tests for Part 4 — import dedup (backfill behavior). A MoneyLover row that
// matches an existing MANUAL transaction by same calendar day + exact amount
// is skipped on import; a non-matching row still imports. Mirrors
// run-agent-turn.test.ts's module-level `vi.mock("@/lib/db", ...)` convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const parseMoneyLoverBufferMock = vi.fn();
vi.mock("@/lib/parse-moneylover", () => ({
  parseMoneyLoverBuffer: (...args: unknown[]) => parseMoneyLoverBufferMock(...args),
}));

import { db } from "@/lib/db";
import { importBuffer } from "./import";

const CATEGORY_NAME = "Food & Dining";

const dbMock = db as unknown as {
  transaction: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

function makeTxContext() {
  return {
    importBatch: {
      deleteMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "batch-1" }),
    },
    moneyLoverCategory: {
      upsert: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ id: "ml-1", name: CATEGORY_NAME }]),
    },
    transaction: { createMany: vi.fn() },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.FINANCIAL_MONTH_START_DAY = "1";
  dbMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTxContext()));
});

const PARSED_BASE = {
  categories: [CATEGORY_NAME],
  periodStart: new Date(2026, 2, 1),
  periodEnd: new Date(2026, 2, 31),
  month: 3,
  year: 2026,
};

describe("importBuffer — dedup against MANUAL transactions", () => {
  it("skips a parsed row that matches a MANUAL transaction by same day + exact amount", async () => {
    parseMoneyLoverBufferMock.mockReturnValue({
      ...PARSED_BASE,
      transactions: [
        { externalId: 1, date: new Date(2026, 2, 10), category: CATEGORY_NAME, amount: -11_956, wallet: "Bancolombia", note: null },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([
      { date: new Date(2026, 2, 10), amount: -11_956 },
    ]);

    const result = await importBuffer(Buffer.from(""), "test.xlsx", "FINAL" as never);

    expect(result).toMatchObject({ imported: 0, skippedAsDuplicate: 1, count: 0 });
  });

  it("imports a non-matching row even when other MANUAL transactions exist", async () => {
    parseMoneyLoverBufferMock.mockReturnValue({
      ...PARSED_BASE,
      transactions: [
        { externalId: 2, date: new Date(2026, 2, 12), category: CATEGORY_NAME, amount: -5_000, wallet: "Bancolombia", note: null },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([
      { date: new Date(2026, 2, 10), amount: -11_956 }, // different day+amount
    ]);

    const result = await importBuffer(Buffer.from(""), "test.xlsx", "FINAL" as never);

    expect(result).toMatchObject({ imported: 1, skippedAsDuplicate: 0, count: 1 });
  });

  it("does not dedup on amount alone when the day differs", async () => {
    parseMoneyLoverBufferMock.mockReturnValue({
      ...PARSED_BASE,
      transactions: [
        { externalId: 3, date: new Date(2026, 2, 11), category: CATEGORY_NAME, amount: -11_956, wallet: "Bancolombia", note: null },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([
      { date: new Date(2026, 2, 10), amount: -11_956 }, // same amount, different day
    ]);

    const result = await importBuffer(Buffer.from(""), "test.xlsx", "FINAL" as never);
    expect(result).toMatchObject({ imported: 1, skippedAsDuplicate: 0 });
  });

  it("queries MANUAL transactions once for the whole batch, not per row", async () => {
    parseMoneyLoverBufferMock.mockReturnValue({
      ...PARSED_BASE,
      transactions: [
        { externalId: 1, date: new Date(2026, 2, 10), category: CATEGORY_NAME, amount: -1_000, wallet: "W", note: null },
        { externalId: 2, date: new Date(2026, 2, 11), category: CATEGORY_NAME, amount: -2_000, wallet: "W", note: null },
        { externalId: 3, date: new Date(2026, 2, 12), category: CATEGORY_NAME, amount: -3_000, wallet: "W", note: null },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([]);

    await importBuffer(Buffer.from(""), "test.xlsx", "FINAL" as never);

    expect(dbMock.transaction.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns imported=0, skippedAsDuplicate=0 with an empty MANUAL set and no parsed rows deduped", async () => {
    parseMoneyLoverBufferMock.mockReturnValue({
      ...PARSED_BASE,
      transactions: [
        { externalId: 1, date: new Date(2026, 2, 10), category: CATEGORY_NAME, amount: -1_000, wallet: "W", note: null },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([]);

    const result = await importBuffer(Buffer.from(""), "test.xlsx", "FINAL" as never);
    expect(result).toMatchObject({ imported: 1, skippedAsDuplicate: 0 });
  });
});
