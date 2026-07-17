// Resolver tests for propose_add_transactions_batch (ADR-034 — card-screenshot
// batch ingestion). Focus: per-item category resolution (rule match by
// vendor vs. no-name fallback), scratch-out → included mapping, card-label
// shortlist degrade behavior, and the two blocking cases (no items, no
// categories).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/queries/expenses", () => ({
  getCategories: vi.fn(),
}));
vi.mock("@/lib/queries/counterparty-rules", () => ({
  matchCounterpartyRule: vi.fn(),
}));
vi.mock("@/lib/queries/installments", () => ({
  getCardSummaries: vi.fn(),
}));

import { getCategories } from "@/lib/queries/expenses";
import { matchCounterpartyRule } from "@/lib/queries/counterparty-rules";
import { getCardSummaries } from "@/lib/queries/installments";
import { resolveAddTransactionsBatch, computeBatchTotal, buildBatchDisplay } from "./transactions-batch";
import type { BatchDescriptor } from "../types";

const getCategoriesMock = getCategories as unknown as ReturnType<typeof vi.fn>;
const matchCounterpartyRuleMock = matchCounterpartyRule as unknown as ReturnType<typeof vi.fn>;
const getCardSummariesMock = getCardSummaries as unknown as ReturnType<typeof vi.fn>;

const CATEGORIES = [
  { id: "cat-going-out", name: "Going Out", budgetType: "VARIABLE" as const },
  { id: "cat-groceries", name: "Groceries", budgetType: "VARIABLE" as const },
  { id: "cat-transport", name: "Transport", budgetType: "VARIABLE" as const },
];

const RAPPI_VENDOR = "Rappi";
const RAPPI_AMOUNT = 45000;
const rappiItem = (overrides?: Record<string, unknown>) => ({
  vendor: RAPPI_VENDOR,
  amount: RAPPI_AMOUNT,
  ...overrides,
});

const VISA_PLATINO = "Visa Platino";

beforeEach(() => {
  vi.clearAllMocks();
  getCategoriesMock.mockResolvedValue(CATEGORIES);
  matchCounterpartyRuleMock.mockResolvedValue(null);
  getCardSummariesMock.mockResolvedValue([]);
});

describe("resolveAddTransactionsBatch", () => {
  it("blocks with no items", async () => {
    const result = await resolveAddTransactionsBatch({ items: [] });
    expect(result.blockingMessage).toBeDefined();
  });

  it("blocks when no categories exist", async () => {
    getCategoriesMock.mockResolvedValue([]);
    const result = await resolveAddTransactionsBatch({
      items: [rappiItem()],
    });
    expect(result.blockingMessage).toBeDefined();
  });

  it("uses a matching counterparty rule's category for an item", async () => {
    matchCounterpartyRuleMock.mockImplementation(async ({ merchant }: { merchant: string }) =>
      merchant === "Rappi" ? { appCategoryId: "cat-going-out" } : null,
    );

    const result = await resolveAddTransactionsBatch({
      items: [rappiItem()],
    });

    const batch = result.params.batch as BatchDescriptor;
    expect(batch.items[0].appCategoryId).toBe("cat-going-out");
  });

  it("falls back to the no-name guess (first category) when no rule matches", async () => {
    const result = await resolveAddTransactionsBatch({
      items: [{ vendor: "Unknown Vendor", amount: 12000 }],
    });

    const batch = result.params.batch as BatchDescriptor;
    expect(batch.items[0].appCategoryId).toBe(CATEGORIES[0].id);
  });

  it("maps scratched: true to included: false and sets scratchDetected", async () => {
    const result = await resolveAddTransactionsBatch({
      items: [
        rappiItem({ scratched: true }),
        { vendor: "Uber", amount: 12000, scratched: false },
      ],
    });

    const batch = result.params.batch as BatchDescriptor;
    expect(batch.items[0].included).toBe(false);
    expect(batch.items[0].scratchDetected).toBe(true);
    expect(batch.items[1].included).toBe(true);
    expect(batch.items[1].scratchDetected).toBeUndefined();
  });

  it("defaults cardLabel to a generic label when omitted", async () => {
    const result = await resolveAddTransactionsBatch({
      items: [rappiItem()],
    });
    const batch = result.params.batch as BatchDescriptor;
    expect(batch.cardLabel).toBeTruthy();
  });

  it("uses the given cardLabel when provided", async () => {
    const result = await resolveAddTransactionsBatch({
      items: [rappiItem()],
      cardLabel: VISA_PLATINO,
    });
    const batch = result.params.batch as BatchDescriptor;
    expect(batch.cardLabel).toBe(VISA_PLATINO);
  });

  it("builds cardLabelOptions from existing CreditCard names when any exist", async () => {
    getCardSummariesMock.mockResolvedValue([
      { id: "card-1", name: VISA_PLATINO, color: null, creditLimit: null, paymentDueDay: null, outstandingDebt: 0, monthlyObligation: 0, installmentCount: 0 },
    ]);

    const result = await resolveAddTransactionsBatch({
      items: [rappiItem()],
      cardLabel: VISA_PLATINO,
    });
    const batch = result.params.batch as BatchDescriptor;
    const labels = batch.cardLabelOptions.map((o) => o.label);
    expect(labels).toContain(VISA_PLATINO);
    expect(labels).toContain("Other…");
  });

  it("degrades to just the default label + Other… when no CreditCards exist", async () => {
    const result = await resolveAddTransactionsBatch({
      items: [rappiItem()],
      cardLabel: "Generic Card",
    });
    const batch = result.params.batch as BatchDescriptor;
    expect(batch.cardLabelOptions).toEqual([
      { id: "Generic Card", label: "Generic Card" },
      { id: "__other__", label: "Other…" },
    ]);
  });

  it("computes the title with included count and total", async () => {
    const result = await resolveAddTransactionsBatch({
      items: [
        rappiItem({ scratched: true }),
        { vendor: "Uber", amount: 12000 },
      ],
    });
    expect(result.title).toContain("1 items");
    expect(result.fields.find((f) => f.label === "Included")?.value).toBe("1");
  });
});

describe("computeBatchTotal", () => {
  it("sums only included items' absolute amounts", () => {
    const batch: BatchDescriptor = {
      cardLabel: "Visa",
      categoryOptions: [],
      cardLabelOptions: [],
      items: [
        { vendor: "A", amount: 1000, appCategoryId: "c1", included: true },
        { vendor: "B", amount: 2000, appCategoryId: "c1", included: false },
        { vendor: "C", amount: 3000, appCategoryId: "c1", included: true },
      ],
    };
    expect(computeBatchTotal(batch)).toBe(4000);
  });
});

describe("buildBatchDisplay", () => {
  it("reflects the current batch state (not a stale snapshot)", () => {
    const batch: BatchDescriptor = {
      cardLabel: "Visa",
      categoryOptions: [{ id: "c1", label: "Groceries" }],
      cardLabelOptions: [],
      items: [{ vendor: "A", amount: 1000, appCategoryId: "c1", included: true }],
    };
    const { title, fields } = buildBatchDisplay(batch);
    expect(title).toContain("Visa");
    expect(fields.find((f) => f.label === "Card")?.value).toBe("Visa");
  });
});
