import { describe, expect, it } from "vitest";
import { opensKeyboard } from "./form-dialog";

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
