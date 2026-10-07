import { describe, expect, it } from "vitest";
import { formatStoredDate } from "./format";
import { loanDate } from "@/components/loans/debtors/loan-row";

// Older rows are stored at UTC midnight; newer ones at local noon (17:00 UTC).
const utcMidnight = new Date("2025-03-20T00:00:00Z");
const localNoon = new Date("2026-08-09T17:00:00Z");

describe("formatStoredDate", () => {
  it("reads the stored UTC calendar day in any timezone", () => {
    expect(formatStoredDate(utcMidnight, { day: "numeric" })).toBe("20");
    expect(formatStoredDate(localNoon, { day: "numeric" })).toBe("9");
  });
});

describe("loanDate", () => {
  it("shows the stored day, not the day before", () => {
    expect(loanDate(utcMidnight)).toBe("20 mar 2025");
    expect(loanDate(localNoon)).toBe("9 ago 2026");
  });
});
