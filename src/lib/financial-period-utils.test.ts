import { describe, it, expect } from "vitest";
import { getFinancialPeriodBounds, financialMonthYear } from "./financial-period-utils";

describe("financialMonthYear", () => {
  it("returns the calendar month when startDay <= 1", () => {
    expect(financialMonthYear(new Date(2026, 1, 25), 1)).toEqual({ month: 2, year: 2026 });
  });

  it("keeps a date before startDay in the current calendar month", () => {
    expect(financialMonthYear(new Date(2026, 1, 24), 25)).toEqual({ month: 2, year: 2026 });
  });

  it("advances a date on/after startDay to the next calendar month", () => {
    expect(financialMonthYear(new Date(2026, 1, 25), 25)).toEqual({ month: 3, year: 2026 });
  });

  it("rolls over the year at December", () => {
    expect(financialMonthYear(new Date(2026, 11, 25), 25)).toEqual({ month: 1, year: 2027 });
  });
});

describe("getFinancialPeriodBounds", () => {
  it("returns the exact calendar month when startDay defaults to 1", () => {
    const { start, end } = getFinancialPeriodBounds(3, 2026);
    expect(start).toEqual(new Date(2026, 2, 1)); // Mar 1
    expect(end).toEqual(new Date(2026, 3, 1)); // Apr 1 (exclusive)
  });

  it("returns the exact calendar month when startDay is explicitly 1", () => {
    const { start, end } = getFinancialPeriodBounds(3, 2026, 1);
    expect(start).toEqual(new Date(2026, 2, 1));
    expect(end).toEqual(new Date(2026, 3, 1));
  });

  it("treats startDay <= 1 the same as startDay = 1 (e.g. 0 or negative)", () => {
    const { start, end } = getFinancialPeriodBounds(3, 2026, 0);
    expect(start).toEqual(new Date(2026, 2, 1));
    expect(end).toEqual(new Date(2026, 3, 1));
  });

  it("shifts the window for a mid-month startDay (startDay=25 → financial March = Feb 25 to Mar 25 exclusive)", () => {
    const { start, end } = getFinancialPeriodBounds(3, 2026, 25);
    expect(start).toEqual(new Date(2026, 1, 25)); // Feb 25
    expect(end).toEqual(new Date(2026, 2, 25)); // Mar 25 (exclusive)
  });

  it("handles year rollover backwards (financial January startDay=25 → Dec 25 previous year)", () => {
    const { start, end } = getFinancialPeriodBounds(1, 2026, 25);
    expect(start).toEqual(new Date(2025, 11, 25)); // Dec 25, 2025
    expect(end).toEqual(new Date(2026, 0, 25)); // Jan 25, 2026 (exclusive)
  });

  it("is the exact inverse of financialMonthYear's classification at the boundaries (startDay=25)", () => {
    // Feb 24 belongs to financial February; Feb 25 belongs to financial March.
    const febBounds = getFinancialPeriodBounds(2, 2026, 25);
    const marBounds = getFinancialPeriodBounds(3, 2026, 25);

    const feb24 = new Date(2026, 1, 24).getTime();
    const feb25 = new Date(2026, 1, 25).getTime();

    expect(feb24 >= febBounds.start.getTime() && feb24 < febBounds.end.getTime()).toBe(true);
    expect(feb25 >= marBounds.start.getTime() && feb25 < marBounds.end.getTime()).toBe(true);
    // Feb 25 must NOT be in February's window (that's the whole point of the shift).
    expect(feb25 >= febBounds.start.getTime() && feb25 < febBounds.end.getTime()).toBe(false);
  });
});
