import { describe, expect, it } from "vitest";
import { keyboardInset, opensKeyboard } from "./form-dialog";

describe("keyboardInset", () => {
  it("is the keyboard height when the fixed layout keeps the full screen (iOS Safari)", () => {
    expect(keyboardInset(844, 508, 0)).toBe(336);
  });
  it("accounts for the visible area being panned down", () => {
    expect(keyboardInset(844, 508, 100)).toBe(236);
  });
  it("is 0 when the fixed layout already shrank for the keyboard (iOS 26 home-screen app, Android)", () => {
    expect(keyboardInset(508, 508, 0)).toBe(0);
  });
  it("never goes negative", () => {
    expect(keyboardInset(500, 508.4, 0)).toBe(0);
  });
});

const input = (type: string) => Object.assign(document.createElement("input"), { type });

describe("opensKeyboard", () => {
  it("is true for text-like fields", () => {
    expect(opensKeyboard(input("text"))).toBe(true);
    expect(opensKeyboard(input("search"))).toBe(true);
    expect(opensKeyboard(document.createElement("textarea"))).toBe(true);
  });
  it("is false for pickers, buttons and nothing", () => {
    expect(opensKeyboard(input("date"))).toBe(false);
    expect(opensKeyboard(input("checkbox"))).toBe(false);
    expect(opensKeyboard(document.createElement("select"))).toBe(false);
    expect(opensKeyboard(document.createElement("button"))).toBe(false);
    expect(opensKeyboard(null)).toBe(false);
  });
});
