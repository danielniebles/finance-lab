import { describe, it, expect } from "vitest";
import {
  predictCategoryLanding,
  projectSavingsRate,
  MIN_MONTHS,
} from "./forecast-utils";

describe("predictCategoryLanding", () => {
  it("returns a prediction with confidence 'high' for a tight 3-point history", () => {
    const result = predictCategoryLanding([800_000, 820_000, 780_000]);
    expect(result).not.toBeNull();
    // Expected should be close to 800k (within 10%)
    expect(result!.expected).toBeGreaterThan(800_000 * 0.9);
    expect(result!.expected).toBeLessThan(800_000 * 1.1);
    expect(result!.confidence).toBe("high");
    expect(result!.low).toBeGreaterThanOrEqual(0);
    expect(result!.high).toBeGreaterThan(result!.low);
  });

  it("returns null when fewer than MIN_MONTHS non-null points exist", () => {
    // Only 1 non-null point — below MIN_MONTHS (3)
    const result = predictCategoryLanding([null, null, 500_000]);
    expect(result).toBeNull();
  });

  it("returns null for an all-null history", () => {
    expect(predictCategoryLanding([null, null, null, null])).toBeNull();
  });

  it("handles exactly MIN_MONTHS non-null points", () => {
    const result = predictCategoryLanding([100_000, 200_000, 300_000]);
    expect(result).not.toBeNull();
  });

  it("skips nulls and counts only non-null points toward MIN_MONTHS", () => {
    // 2 non-null points scattered among nulls — still below threshold
    const result = predictCategoryLanding([null, 500_000, null, 600_000]);
    expect(result).toBeNull();
  });

  it("applies recency weighting (newest month weighs more)", () => {
    // Trend sharply upward: 100k, 200k, 900k
    // Weighted mean should be closer to 900k than unweighted mean (400k)
    const result = predictCategoryLanding([100_000, 200_000, 900_000]);
    expect(result).not.toBeNull();
    expect(result!.expected).toBeGreaterThan(400_000);
  });

  it("returns confidence 'low' for high-variance history", () => {
    // Std dev much larger than 25% of mean
    const result = predictCategoryLanding([100_000, 500_000, 900_000]);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("low");
  });
});

describe("projectSavingsRate", () => {
  it("computes ~24% for the canonical example", () => {
    const rate = projectSavingsRate({
      expectedIncome: 5_000_000,
      fixedBudget: 2_000_000,
      predictedVariable: 1_800_000,
    });
    // (5M - (2M + 1.8M)) / 5M * 100 = 1.2M / 5M * 100 = 24%
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(24, 0);
  });

  it("returns null when expectedIncome is 0", () => {
    const rate = projectSavingsRate({
      expectedIncome: 0,
      fixedBudget: 0,
      predictedVariable: 0,
    });
    expect(rate).toBeNull();
  });

  it("returns negative when spending exceeds income", () => {
    const rate = projectSavingsRate({
      expectedIncome: 1_000_000,
      fixedBudget: 800_000,
      predictedVariable: 500_000,
    });
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
  });

  it("returns 0 when spending exactly equals income", () => {
    const rate = projectSavingsRate({
      expectedIncome: 3_000_000,
      fixedBudget: 1_500_000,
      predictedVariable: 1_500_000,
    });
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0, 5);
  });
});

describe("MIN_MONTHS constant", () => {
  it("is 3", () => {
    expect(MIN_MONTHS).toBe(3);
  });
});
