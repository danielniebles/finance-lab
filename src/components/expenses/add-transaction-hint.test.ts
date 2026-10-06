import { describe, expect, it } from "vitest";
import { missingFieldsHint } from "./add-transaction-button";

const base = { type: "expense" as const, amount: "", date: "2026-10-06", appCategoryId: "", walletId: "", toWalletId: "", note: "", tagNames: "" };

describe("missingFieldsHint", () => {
  it("names everything that's missing", () => {
    expect(missingFieldsHint(base)).toBe("Add an amount, a category and a wallet to save.");
    expect(missingFieldsHint({ ...base, amount: "5000", walletId: "w" })).toBe("Add a category to save.");
  });
  it("asks for both wallets on a transfer", () => {
    expect(missingFieldsHint({ ...base, type: "transfer", amount: "1", walletId: "a" })).toBe("Add both wallets to save.");
  });
  it("is empty when the form can be saved", () => {
    expect(missingFieldsHint({ ...base, amount: "1", appCategoryId: "c", walletId: "w" })).toBe("");
  });
});
