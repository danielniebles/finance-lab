import { describe, expect, it } from "vitest";
import { HEALTH_RULES, scoreMetric, tierFor, totalScore } from "./health-score-utils";

describe("health score rules", () => {
  it("scores ascending and descending metrics", () => {
    expect(scoreMetric(25, HEALTH_RULES.savings)).toEqual({ points: 25, status: "good" });
    expect(scoreMetric(-1.4, HEALTH_RULES.savings)).toEqual({ points: 0, status: "bad" });
    expect(scoreMetric(95, HEALTH_RULES.burn)).toEqual({ points: 15, status: "warn" });
    expect(scoreMetric(null, HEALTH_RULES.burn)).toEqual({ points: 0, status: "na" });
  });

  it("totals the four metrics", () => {
    expect(
      totalScore({ savingsRate: 22, variableBurnRate: 70, totalIncome: 100, totalObligation: 5, liquidityRatio: 80 }),
    ).toBe(100);
    // No income → burden can't be computed and scores 0.
    expect(
      totalScore({ savingsRate: null, variableBurnRate: 70, totalIncome: 0, totalObligation: 5, liquidityRatio: 80 }),
    ).toBe(50);
  });

  it("tiers", () => {
    expect(tierFor(90)).toBe("Excellent");
    expect(tierFor(65)).toBe("Good");
    expect(tierFor(45)).toBe("Fair");
    expect(tierFor(10)).toBe("At Risk");
  });
});
