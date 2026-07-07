// Resolver tests for propose_create/update/delete_counterparty_rule.
// Focus: category-name resolution success/failure, and confirming the
// BLOCK-on-unresolved behavior (unlike resolveAddTransaction's silent
// fallback-to-first-category).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/queries/expenses", () => ({
  getCategories: vi.fn(),
}));
vi.mock("@/lib/queries/counterparty-rules", () => ({
  getCounterpartyRules: vi.fn(),
}));

import { getCategories } from "@/lib/queries/expenses";
import { getCounterpartyRules } from "@/lib/queries/counterparty-rules";
import {
  resolveCreateCounterpartyRule,
  resolveUpdateCounterpartyRule,
  resolveDeleteCounterpartyRule,
} from "./counterparty-rules";

const getCategoriesMock = getCategories as unknown as ReturnType<typeof vi.fn>;
const getCounterpartyRulesMock = getCounterpartyRules as unknown as ReturnType<typeof vi.fn>;

const CATEGORIES = [
  { id: "cat-pets", name: "Pets", budgetType: "VARIABLE" as const },
  { id: "cat-family", name: "Family", budgetType: "VARIABLE" as const },
];

const EXISTING_RULE = {
  id: "rule-1",
  matchType: "ACCOUNT" as const,
  matchValue: "61793614704",
  direction: "ANY" as const,
  appCategoryId: "cat-pets",
  appCategoryName: "Pets",
  wallet: "Investments",
  autoRecord: true,
  recurring: false,
  expectedAmount: null,
  notes: null,
  matchCount: 3,
  lastMatchedAt: null,
  createdAt: new Date("2026-06-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  getCategoriesMock.mockResolvedValue(CATEGORIES);
  getCounterpartyRulesMock.mockResolvedValue([EXISTING_RULE]);
});

describe("resolveCreateCounterpartyRule", () => {
  it("resolves an exact category name match", async () => {
    const result = await resolveCreateCounterpartyRule({
      matchType: "ACCOUNT",
      matchValue: "617 9361 4704",
      appCategoryName: "Pets",
      wallet: "Investments",
    });

    expect(result.blockingMessage).toBeUndefined();
    expect(result.params.appCategoryId).toBe("cat-pets");
  });

  it("resolves a case-insensitive partial category name match", async () => {
    const result = await resolveCreateCounterpartyRule({
      matchType: "MERCHANT",
      matchValue: "Rappi",
      appCategoryName: "fam",
      wallet: "Bancolombia",
    });

    expect(result.blockingMessage).toBeUndefined();
    expect(result.params.appCategoryId).toBe("cat-family");
  });

  it("BLOCKS (does not fall back) when the category name doesn't resolve", async () => {
    const result = await resolveCreateCounterpartyRule({
      matchType: "SENDER",
      matchValue: "Juan",
      appCategoryName: "Totally Nonexistent Category",
      wallet: "Investments",
    });

    expect(result.blockingMessage).toBeDefined();
    expect(result.blockingMessage).toContain("not found");
    // Must NOT silently default to some category id
    expect(result.params.appCategoryId).toBeUndefined();
  });

  it("defaults direction to ANY, autoRecord to true, recurring to false", async () => {
    const result = await resolveCreateCounterpartyRule({
      matchType: "KEYWORD",
      matchValue: "netflix",
      appCategoryName: "Pets",
      wallet: "W",
    });

    expect(result.params.direction).toBe("ANY");
    expect(result.params.autoRecord).toBe(true);
    expect(result.params.recurring).toBe(false);
  });
});

describe("resolveUpdateCounterpartyRule", () => {
  it("BLOCKS when the ruleId doesn't resolve to an existing rule", async () => {
    const result = await resolveUpdateCounterpartyRule({ ruleId: "does-not-exist" });

    expect(result.blockingMessage).toBeDefined();
    expect(result.blockingMessage).toContain("No counterparty rule found");
  });

  it("keeps the rule's current category when appCategoryName is omitted", async () => {
    const result = await resolveUpdateCounterpartyRule({
      ruleId: "rule-1",
      wallet: "Nequi",
    });

    expect(result.blockingMessage).toBeUndefined();
    expect(result.params.appCategoryId).toBe("cat-pets");
    expect(result.params.wallet).toBe("Nequi");
  });

  it("resolves a new category name override", async () => {
    const result = await resolveUpdateCounterpartyRule({
      ruleId: "rule-1",
      appCategoryName: "Family",
    });

    expect(result.blockingMessage).toBeUndefined();
    expect(result.params.appCategoryId).toBe("cat-family");
  });

  it("BLOCKS (does not fall back) when the override category name doesn't resolve", async () => {
    const result = await resolveUpdateCounterpartyRule({
      ruleId: "rule-1",
      appCategoryName: "Nonexistent",
    });

    expect(result.blockingMessage).toBeDefined();
    expect(result.blockingMessage).toContain("not found");
  });

  it("preserves unspecified fields from the existing rule", async () => {
    const result = await resolveUpdateCounterpartyRule({ ruleId: "rule-1" });

    expect(result.params).toMatchObject({
      matchType: "ACCOUNT",
      matchValue: "61793614704",
      direction: "ANY",
      wallet: "Investments",
      autoRecord: true,
      recurring: false,
    });
  });
});

describe("resolveDeleteCounterpartyRule", () => {
  it("resolves an existing ruleId", async () => {
    const result = await resolveDeleteCounterpartyRule({ ruleId: "rule-1" });

    expect(result.blockingMessage).toBeUndefined();
    expect(result.params.ruleId).toBe("rule-1");
    expect(result.title).toContain("Pets");
  });

  it("BLOCKS when the ruleId doesn't resolve", async () => {
    const result = await resolveDeleteCounterpartyRule({ ruleId: "nope" });

    expect(result.blockingMessage).toBeDefined();
    expect(result.blockingMessage).toContain("No counterparty rule found");
  });
});
