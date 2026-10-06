import { describe, expect, it } from "vitest";
import { editMissingHint } from "./transaction-row";

const base = { kind: "expense" as const, amount: "48900", date: "2026-10-06", appCategoryId: null, walletId: "w1", note: "", tagNames: "" };

describe("editMissingHint", () => {
  it("is empty for a valid edit, even without a category", () => {
    expect(editMissingHint(base)).toBe("");
  });
  it("asks for an amount and for a wallet on legacy rows without one", () => {
    expect(editMissingHint({ ...base, amount: "" })).toBe("Add an amount to save.");
    expect(editMissingHint({ ...base, walletId: "" })).toBe("Pick a wallet to save.");
  });
});
