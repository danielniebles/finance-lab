// @vitest-environment node
//
// Pure "same point last month" math: equal-length period-to-date windows,
// per-window totals, category deltas and the wallet balance decomposition.

import { describe, it, expect } from "vitest";
import {
  compareCategorySpend,
  currentPeriodDay,
  decomposeWalletChange,
  periodToDateWindow,
  shiftMonth,
  summarizeWindow,
  UNCATEGORIZED,
  type CategorizedFlow,
  type WindowTotals,
} from "./period-comparison-utils";

const START_DAY = 25;

function flow(date: Date, amount: number, category: string | null = "Food", isTransfer = false): CategorizedFlow {
  return { date, amount, category, isTransfer };
}

function totals(spendByCategory: Record<string, number>, overrides: Partial<WindowTotals> = {}): WindowTotals {
  const spend = Object.values(spendByCategory).reduce((s, v) => s + v, 0);
  return { income: 0, spend, transfersNet: 0, spendByCategory, ...overrides };
}

describe("shiftMonth", () => {
  it("wraps across year boundaries both ways", () => {
    expect(shiftMonth(1, 2026, -1)).toEqual({ month: 12, year: 2025 });
    expect(shiftMonth(12, 2026, 1)).toEqual({ month: 1, year: 2027 });
    expect(shiftMonth(10, 2026, -4)).toEqual({ month: 6, year: 2026 });
  });
});

describe("periodToDateWindow", () => {
  it("day 20 of October (startDay 25) is Sep 25 → Oct 15 exclusive", () => {
    const w = periodToDateWindow(10, 2026, 20, START_DAY);
    expect(w.start).toEqual(new Date(2026, 8, 25));
    expect(w.end).toEqual(new Date(2026, 9, 15));
  });

  it("the previous period's day 20 has the same length", () => {
    const w = periodToDateWindow(9, 2026, 20, START_DAY);
    expect(w.start).toEqual(new Date(2026, 7, 25));
    expect(w.end).toEqual(new Date(2026, 8, 14));
  });

  it("caps at the period end when day exceeds the period length", () => {
    const w = periodToDateWindow(3, 2026, 31, START_DAY); // Feb 25 → Mar 25 is 28 days
    expect(w.end).toEqual(new Date(2026, 2, 25));
  });
});

describe("currentPeriodDay", () => {
  it("counts the period's first day as day 1", () => {
    expect(currentPeriodDay(new Date(2026, 8, 25, 9), START_DAY)).toEqual({ month: 10, year: 2026, day: 1 });
  });

  it("Oct 14 is day 20 of the October period", () => {
    expect(currentPeriodDay(new Date(2026, 9, 14, 23), START_DAY)).toEqual({ month: 10, year: 2026, day: 20 });
  });
});

describe("summarizeWindow", () => {
  const window = periodToDateWindow(10, 2026, 20, START_DAY);

  it("splits income, spend by category and transfers; ignores rows outside the window", () => {
    const t = summarizeWindow(
      [
        flow(new Date(2026, 8, 26), 7_000_000, "Income"),
        flow(new Date(2026, 8, 27), -500_000, "Supermarket"),
        flow(new Date(2026, 9, 1), -100_000, null),
        flow(new Date(2026, 9, 2), -300_000, "Savings move", true),
        flow(new Date(2026, 9, 15), -999_999, "Supermarket"), // window end is exclusive
        flow(new Date(2026, 8, 24), -999_999, "Supermarket"), // before start
      ],
      window,
    );
    expect(t).toEqual({
      income: 7_000_000,
      spend: 600_000,
      transfersNet: -300_000,
      spendByCategory: { Supermarket: 500_000, [UNCATEGORIZED]: 100_000 },
    });
  });
});

describe("compareCategorySpend", () => {
  it("covers every category, largest absolute delta first, with a baseline average", () => {
    const rows = compareCategorySpend(
      totals({ Travel: 4_000_000, Supermarket: 500_000 }),
      totals({ Supermarket: 1_200_000, Gas: 100_000 }),
      [totals({ Supermarket: 1_000_000 }), totals({ Gas: 300_000 })],
    );
    expect(rows.map((r) => r.category)).toEqual(["Travel", "Supermarket", "Gas"]);
    expect(rows[1]).toEqual({
      category: "Supermarket",
      current: 500_000,
      previous: 1_200_000,
      delta: -700_000,
      baselineAvg: 500_000,
    });
  });

  it("baselineAvg is null without baseline windows", () => {
    expect(compareCategorySpend(totals({ A: 1 }), totals({}))[0].baselineAvg).toBeNull();
  });
});

describe("decomposeWalletChange", () => {
  it("splits the end-balance difference exactly into its causes", () => {
    const current = {
      startBalance: 365_000,
      endBalance: 3_255_000,
      totals: totals({ Food: 10_000_000 }, { income: 13_000_000 }),
    };
    // Previous window: 1_000_000 left through non-transaction flows (loans, vaults).
    const previous = {
      startBalance: -295_000,
      endBalance: 855_000,
      totals: totals({ Food: 12_000_000 }, { income: 13_100_000, transfersNet: 1_050_000 }),
    };
    const c = decomposeWalletChange(current, previous);
    expect(c).toEqual({
      endBalanceDelta: 2_400_000,
      carryover: 660_000,
      incomeDelta: -100_000,
      spendDelta: -2_000_000,
      transfersDelta: -1_050_000,
      otherFlowsDelta: 890_000,
    });
    expect(c.carryover + c.incomeDelta - c.spendDelta + c.transfersDelta + c.otherFlowsDelta).toBe(c.endBalanceDelta);
  });
});
