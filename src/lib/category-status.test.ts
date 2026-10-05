import { describe, expect, it } from "vitest";
import { categoryStatus, groupCategories, isEmptyCategory, meterTone, type CategoryStatusRow } from "./category-status";

function row(o: Partial<CategoryStatusRow>): CategoryStatusRow {
  return { id: o.name ?? "x", name: "X", budgetType: "VARIABLE", spent: 0, budget: 0, control: 0, percentUsed: null, note: null, severity: "OK", ...o };
}

describe("categoryStatus", () => {
  it("labels fixed bills by payment state", () => {
    expect(categoryStatus(row({ budgetType: "FIXED", severity: "Pending" }))).toEqual({ label: "Pending", tone: "info" });
    expect(categoryStatus(row({ budgetType: "FIXED", severity: "Issue", note: "Unpaid" })).label).toBe("Unpaid");
    expect(categoryStatus(row({ budgetType: "FIXED", severity: "OK", note: "Lower than expected" })).label).toBe("Paid · less");
    expect(categoryStatus(row({ budgetType: "FIXED", severity: "Issue", note: "Higher than expected" })).label).toBe("Paid · more");
  });
  it("labels variable spend by budget", () => {
    expect(categoryStatus(row({ severity: "Unplanned" }))).toEqual({ label: "No budget", tone: "unplanned" });
    expect(categoryStatus(row({ severity: "Critical" })).tone).toBe("danger");
    expect(categoryStatus(row({ severity: "OK" })).label).toBe("On track");
  });
});

describe("meterTone", () => {
  it("is caution only when a fixed bill came in above budget", () => {
    expect(meterTone(row({ budgetType: "FIXED", spent: 80, budget: 100 }))).toBe("positive");
    expect(meterTone(row({ budgetType: "FIXED", spent: 120, budget: 100 }))).toBe("caution");
    expect(meterTone(row({ percentUsed: 214 }))).toBe("danger");
  });
});

describe("grouping", () => {
  it("splits fixed from variable/mixed and sorts by spend", () => {
    const g = groupCategories([
      row({ name: "a", budgetType: "FIXED", spent: 1 }),
      row({ name: "b", budgetType: "MIXED", spent: 5 }),
      row({ name: "c", spent: 9 }),
      row({ name: "d", budgetType: "FIXED", spent: 3 }),
    ]);
    expect(g.fixed.map((r) => r.name)).toEqual(["d", "a"]);
    expect(g.variable.map((r) => r.name)).toEqual(["c", "b"]);
  });
  it("treats no-budget, no-spend rows as empty", () => {
    expect(isEmptyCategory({ budget: 0, spent: 0 })).toBe(true);
    expect(isEmptyCategory({ budget: 10, spent: 0 })).toBe(false);
  });
});
