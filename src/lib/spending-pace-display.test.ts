// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  cumulativeSpendByDay,
  formatWindowRange,
  pacePercent,
  pacePoints,
  periodLength,
  splitCategoryChanges,
  walletChangeReasons,
} from "./spending-pace-display";
import type { CategorizedFlow, CategoryDelta } from "./period-comparison-utils";

const start = new Date(2026, 8, 25, 0, 0, 0);
const at = (day: number, hour = 12) => new Date(2026, 8, 24 + day, hour);
const flow = (date: Date, amount: number, isTransfer = false): CategorizedFlow => ({ date, amount, category: "Food", isTransfer });

describe("periodLength", () => {
  it("counts calendar days, end exclusive", () => {
    expect(periodLength(start, new Date(2026, 9, 25))).toBe(30);
  });
});

describe("cumulativeSpendByDay", () => {
  it("accumulates spending per day, ignoring income, transfers and days outside", () => {
    const flows = [
      flow(at(1), -100),
      flow(at(1, 23), -50),
      flow(at(2), 1_000),
      flow(at(3), -20, true),
      flow(at(3), -30),
      flow(at(0), -999),
      flow(at(5), -999),
    ];
    expect(cumulativeSpendByDay(flows, start, 4)).toEqual([150, 150, 180, 180]);
  });
});

describe("pacePoints", () => {
  it("ends this period at today and splits last period at today's point", () => {
    const points = pacePoints([10, 20], [5, 15, 25, 35], 2);
    expect(points).toHaveLength(4);
    expect(points[1]).toEqual({ day: 2, current: 20, previousSoFar: 15, previousRest: 15 });
    expect(points[0].previousRest).toBeNull();
    expect(points[3]).toEqual({ day: 4, current: null, previousSoFar: null, previousRest: 35 });
  });
});

describe("pacePercent", () => {
  it("is null without anything last period", () => {
    expect(pacePercent(100, 0)).toBeNull();
    expect(pacePercent(119, 100)).toBeCloseTo(19);
  });
});

describe("formatWindowRange", () => {
  it("shows the last included day", () => {
    expect(formatWindowRange(new Date(2026, 9, 25), new Date(2026, 10, 4))).toBe("Oct 25 – Nov 3");
    expect(formatWindowRange(new Date(2026, 9, 25), new Date(2026, 9, 26))).toBe("Oct 25");
  });
});

const delta = (category: string, current: number, previous: number): CategoryDelta => ({
  category,
  current,
  previous,
  delta: current - previous,
  baselineAvg: null,
});

describe("splitCategoryChanges", () => {
  const categories = [
    delta("Health", 621_000, 0),
    delta("Pets", 474_967, 75_326),
    delta("Credit Cards", 0, 456_356),
    delta("Pharmacy", 0, 45_224),
    delta("Rent", 500_000, 500_000),
    delta("Travel", 0, 0),
  ];

  it("splits by direction, largest first", () => {
    const r = splitCategoryChanges(categories, ["Credit Cards"]);
    expect(r.more.map((c) => c.category)).toEqual(["Health", "Pets"]);
    expect(r.less.map((c) => c.category)).toEqual(["Credit Cards", "Pharmacy"]);
    expect(r.moreTotal).toBe(621_000 + 399_641);
    expect(r.lessTotal).toBe(-(456_356 + 45_224));
  });

  it("flags new categories and drops explained by unpaid bills", () => {
    const r = splitCategoryChanges(categories, ["Credit Cards", "Health"]);
    expect(r.more[0]).toMatchObject({ category: "Health", isNew: true, notPaidYet: false });
    expect(r.less[0].notPaidYet).toBe(true);
    expect(r.less[1].notPaidYet).toBe(false);
  });

  it("counts unchanged categories with spend, not baseline-only ones", () => {
    expect(splitCategoryChanges(categories).unchanged).toBe(1);
  });

  it("carries stored icon/color overrides, null when none", () => {
    const r = splitCategoryChanges(categories, [], { Pets: { icon: "paw-print", color: "amber" } });
    expect(r.more[1]).toMatchObject({ category: "Pets", icon: "paw-print", color: "amber" });
    expect(r.more[0]).toMatchObject({ category: "Health", icon: null, color: null });
  });
});

describe("walletChangeReasons", () => {
  it("signs each cause by its effect on the balance and drops zeros", () => {
    const reasons = walletChangeReasons({
      endBalanceDelta: -1_269_567,
      carryover: -279_985,
      incomeDelta: 0,
      spendDelta: 989_582,
      transfersDelta: 0,
      otherFlowsDelta: 0,
    });
    expect(reasons).toEqual([
      { label: "Started lower", value: -279_985 },
      { label: "Spent more", value: -989_582 },
    ]);
    expect(reasons.reduce((s, r) => s + r.value, 0)).toBe(-1_269_567);
  });
});
