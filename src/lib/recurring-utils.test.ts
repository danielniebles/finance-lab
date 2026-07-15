import { describe, it, expect } from "vitest";
import { monthsUntilDue, monthlySetAside, isDueInMonth } from "./recurring-utils";

describe("monthsUntilDue", () => {
  it("returns 1 when due in the current (calendar) month", () => {
    expect(monthsUntilDue(new Date(2026, 6, 20), 7, 2026)).toBe(1);
  });

  it("returns 2 when due next calendar month (regression: used to return 1)", () => {
    // Due Aug 20, reporting July — was the Car sinking-fund bug: the whole
    // amount was demanded this month instead of being spread over 2 months.
    expect(monthsUntilDue(new Date(2026, 7, 20), 7, 2026)).toBe(2);
  });

  it("returns 3 when due 2 calendar months out", () => {
    expect(monthsUntilDue(new Date(2026, 8, 21), 7, 2026)).toBe(3);
  });

  it("floors at 1 for a past due date", () => {
    expect(monthsUntilDue(new Date(2026, 5, 1), 7, 2026)).toBe(1);
  });

  describe("with a mid-month startDay (financial months)", () => {
    it("classifies a late-month due date into the next financial month", () => {
      // startDay=25: Aug 27 belongs to financial September, not August.
      // Reporting financial-August (month=8) → due is 1 financial month out.
      expect(monthsUntilDue(new Date(2026, 7, 27), 8, 2026, 25)).toBe(2);
    });

    it("keeps an early-month due date in the same financial month", () => {
      // Aug 20 is still financial-August (before the 25th).
      expect(monthsUntilDue(new Date(2026, 7, 20), 8, 2026, 25)).toBe(1);
    });
  });
});

describe("monthlySetAside", () => {
  it("splits the estimated amount across monthsUntilDue", () => {
    expect(monthlySetAside(544700, new Date(2026, 7, 20), 7, 2026)).toBeCloseTo(544700 / 2);
  });
});

describe("isDueInMonth", () => {
  it("matches the calendar month by default", () => {
    expect(isDueInMonth(new Date(2026, 7, 20), 8, 2026)).toBe(true);
    expect(isDueInMonth(new Date(2026, 7, 20), 7, 2026)).toBe(false);
  });

  it("respects a mid-month startDay", () => {
    // Aug 27 belongs to financial September (startDay=25).
    expect(isDueInMonth(new Date(2026, 7, 27), 9, 2026, 25)).toBe(true);
    expect(isDueInMonth(new Date(2026, 7, 27), 8, 2026, 25)).toBe(false);
  });
});
