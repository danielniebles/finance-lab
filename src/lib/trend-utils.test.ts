import { describe, expect, it } from "vitest";
import { categoryRowStats, completeAverage, shiftMonth, sortByAverage, signedCompact, trendWindow, trimLeadingEmpty } from "./trend-utils";

describe("trend-utils", () => {
  it("shiftMonth crosses year boundaries", () => {
    expect(shiftMonth({ month: 1, year: 2026 }, -1)).toEqual({ month: 12, year: 2025 });
    expect(shiftMonth({ month: 11, year: 2026 }, 3)).toEqual({ month: 2, year: 2027 });
  });

  it("trendWindow lists complete months, then the running one", () => {
    const w = trendWindow(new Date(2026, 0, 15), 2, 1, true);
    expect(w).toEqual([
      { month: 11, year: 2025, inProgress: false },
      { month: 12, year: 2025, inProgress: false },
      { month: 1, year: 2026, inProgress: true },
    ]);
  });

  it("trendWindow respects a mid-month financial start day", () => {
    // Jan 26 with startDay 25 is already financial February.
    const w = trendWindow(new Date(2026, 0, 26), 1, 25, true);
    expect(w.map((m) => m.month)).toEqual([1, 2]);
  });

  it("trimLeadingEmpty keeps interior gaps", () => {
    expect(trimLeadingEmpty([0, 0, 3, 0, 5], (v) => v > 0)).toEqual([3, 0, 5]);
    expect(trimLeadingEmpty([0, 0], (v) => v > 0)).toEqual([]);
  });

  it("completeAverage skips the running month and empty slots", () => {
    expect(completeAverage([100, null, 300, 5], [false, false, false, true])).toBe(200);
    expect(completeAverage([5], [true])).toBeNull();
  });

  it("signedCompact", () => {
    expect(signedCompact(4_200_000)).toBe("+4.2M");
    expect(signedCompact(-180_000)).toBe("−180k");
  });
});

describe("category row stats", () => {
  const flags = [false, false, false, true];
  it("splits average, last complete and running month", () => {
    const s = categoryRowStats({ id: "a", name: "A", budget: 150, months: [100, null, 300, 40] }, flags);
    expect(s).toMatchObject({ avg: 200, last: 300, current: 40, overBudgetOnAverage: true });
  });
  it("never flags a category without budget as over budget", () => {
    expect(categoryRowStats({ id: "a", name: "A", budget: 0, months: [10, 10, 10, 1] }, flags).overBudgetOnAverage).toBe(false);
  });
  it("sorts by average, running-only rows last", () => {
    const rows = [
      categoryRowStats({ id: "new", name: "New", budget: 0, months: [null, null, null, 999] }, flags),
      categoryRowStats({ id: "small", name: "S", budget: 0, months: [10, 10, 10, 0] }, flags),
      categoryRowStats({ id: "big", name: "B", budget: 0, months: [50, 50, 50, 0] }, flags),
    ];
    expect(sortByAverage(rows).map((r) => r.id)).toEqual(["big", "small", "new"]);
  });
});
