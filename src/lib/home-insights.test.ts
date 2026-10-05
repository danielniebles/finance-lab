import { describe, expect, it } from "vitest";
import { buildHomeInsights, isPendingFixed, type InsightCategory } from "./home-insights";

function cat(overrides: Partial<InsightCategory>): InsightCategory {
  return {
    id: overrides.name ?? "x",
    name: "X",
    spent: 0,
    budget: 0,
    percentUsed: null,
    severity: "OK",
    note: null,
    budgetType: "VARIABLE",
    ...overrides,
  };
}

// October 2026 numbers from the real dashboard.
const october: InsightCategory[] = [
  cat({ name: "Travel", spent: 4_874_498, severity: "Unplanned" }),
  cat({ name: "Personal Care", spent: 500_000, severity: "Unplanned" }),
  cat({ name: "Health & Fitness", budget: 1_131_000, severity: "Issue", note: "Unpaid", budgetType: "FIXED" }),
  cat({ name: "Family", budget: 1_000_000, severity: "Issue", note: "Unpaid", budgetType: "FIXED" }),
  cat({ name: "Phone Bill", budget: 60_000, severity: "Issue", note: "Unpaid", budgetType: "FIXED" }),
  cat({ name: "Bills & Utilities", spent: 3_482_800, budget: 4_336_800, percentUsed: 80, budgetType: "FIXED", note: "Lower than expected" }),
  cat({ name: "Credit Cards", spent: 913_359, budget: 1_500_000, percentUsed: 61 }),
];

describe("buildHomeInsights", () => {
  it("lists unplanned spend first, biggest first", () => {
    const out = buildHomeInsights(october);
    expect(out.map((i) => i.title)).toEqual([
      "Travel has no budget",
      "Personal Care has no budget",
      "3 fixed bills not paid yet",
    ]);
  });

  it("treats unpaid fixed bills as pending info, never as an issue", () => {
    const pending = buildHomeInsights(october).find((i) => i.key === "pending-fixed");
    expect(pending?.tone).toBe("info");
    expect(pending?.amount).toBe(2_191_000);
    expect(pending?.detail).toBe("Health & Fitness, Family, Phone Bill");
  });

  it("reports over-budget categories with the overspend amount", () => {
    const out = buildHomeInsights([
      cat({ name: "Going Out", spent: 757_592, budget: 400_000, percentUsed: 189, severity: "Critical" }),
    ]);
    expect(out[0]).toMatchObject({ title: "Going Out is over budget", tone: "danger", amount: 357_592 });
  });

  it("caps the list at three", () => {
    const many = Array.from({ length: 5 }, (_, i) => cat({ id: `u${i}`, name: `U${i}`, spent: 1000 + i, severity: "Unplanned" }));
    expect(buildHomeInsights(many)).toHaveLength(3);
  });

  it("returns nothing when all is fine", () => {
    expect(buildHomeInsights([cat({ name: "Ok", spent: 10, budget: 100, percentUsed: 10 })])).toEqual([]);
  });
});

describe("isPendingFixed", () => {
  it("only matches budgeted fixed categories with nothing spent", () => {
    expect(isPendingFixed(cat({ budgetType: "FIXED", budget: 10 }))).toBe(true);
    expect(isPendingFixed(cat({ budgetType: "FIXED", budget: 10, spent: 1 }))).toBe(false);
    expect(isPendingFixed(cat({ budgetType: "VARIABLE", budget: 10 }))).toBe(false);
  });
});
