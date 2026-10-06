import { describe, it, expect } from "vitest";
import { budgetItemMissingHint, categoryDeleteBlocker, ruleMissingHint } from "./settings-forms";

describe("categoryDeleteBlocker", () => {
  const none = { transactions: 0, rules: 0, mappings: 0, recurring: 0 };

  it("allows deleting an unused category", () => {
    expect(categoryDeleteBlocker(none)).toBeNull();
  });

  it("names what still uses it", () => {
    expect(categoryDeleteBlocker({ ...none, transactions: 1 })).toBe(
      "1 transaction still use it. Move them to another category first.",
    );
    expect(categoryDeleteBlocker({ transactions: 12, rules: 2, mappings: 1, recurring: 0 })).toBe(
      "12 transactions, 2 rules and 1 legacy mapping still use it. Move them to another category first.",
    );
  });
});

describe("budgetItemMissingHint", () => {
  it("asks for a name, then an amount", () => {
    expect(budgetItemMissingHint(" ", "100")).toBe("Name the item.");
    expect(budgetItemMissingHint("Rent", "")).toBe("Add the monthly amount.");
    expect(budgetItemMissingHint("Rent", "1500000")).toBe("");
  });
});

describe("ruleMissingHint", () => {
  const ready = { matchType: "MERCHANT" as const, matchValue: "RAPPI", appCategoryId: "c", walletId: "w" };
  it("asks for the value, category and wallet in order", () => {
    expect(ruleMissingHint({ ...ready, matchValue: "" })).toBe("Add the merchant name.");
    expect(ruleMissingHint({ ...ready, appCategoryId: "" })).toBe("Pick a category.");
    expect(ruleMissingHint({ ...ready, walletId: "" })).toBe("Pick a wallet.");
    expect(ruleMissingHint(ready)).toBe("");
  });
});
