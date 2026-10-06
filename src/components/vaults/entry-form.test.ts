import { describe, expect, it } from "vitest";
import { entryMissingHint } from "./entry-form";

const base = { amount: "", date: "2026-10-06", notes: "", walletId: null, appCategoryId: null };

describe("entryMissingHint", () => {
  it("asks for an amount first", () => {
    expect(entryMissingHint(base, "contribute")).toBe("Add an amount to save.");
  });
  it("needs a category only for a contribution from a wallet", () => {
    expect(entryMissingHint({ ...base, amount: "5000" }, "contribute")).toBe("");
    expect(entryMissingHint({ ...base, amount: "5000", walletId: "w" }, "contribute")).toBe("Pick a category for the wallet expense.");
    expect(entryMissingHint({ ...base, amount: "5000", walletId: "w", appCategoryId: "c" }, "contribute")).toBe("");
    expect(entryMissingHint({ ...base, amount: "5000", walletId: "w" }, "withdraw")).toBe("");
  });
});
