import { describe, expect, it } from "vitest";
import { opensKeyboard, revealDelta } from "./form-dialog";

describe("revealDelta", () => {
  const view = { top: 100, bottom: 400 };
  it("is 0 when the field is already inside the view", () => {
    expect(revealDelta({ top: 150, bottom: 200 }, view)).toBe(0);
  });
  it("scrolls up for a field above the view", () => {
    expect(revealDelta({ top: 50, bottom: 90 }, view)).toBe(-58);
  });
  it("scrolls down for a field below the view", () => {
    expect(revealDelta({ top: 420, bottom: 470 }, view)).toBe(78);
  });
  it("aligns a field taller than the view to its top", () => {
    expect(revealDelta({ top: 300, bottom: 800 }, view)).toBe(192);
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
