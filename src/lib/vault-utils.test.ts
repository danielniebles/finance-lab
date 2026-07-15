import { describe, it, expect } from "vitest";
import { monthsLeft, computeVaultMetrics, classifyVault, type VaultPeriod } from "./vault-utils";

describe("monthsLeft", () => {
  it("counts the current month even when the target is in the same month", () => {
    expect(monthsLeft(new Date(2026, 6, 20), { month: 7, year: 2026 })).toBe(1);
  });

  it("is inclusive of both endpoints (Brazil case: today Jul, target Sep 21)", () => {
    // July, August, September = 3 whole months.
    expect(monthsLeft(new Date(2026, 8, 21), { month: 7, year: 2026 })).toBe(3);
  });

  it("respects a mid-month startDay when classifying the target date", () => {
    // startDay=25: Sep 27 belongs to financial October, not September.
    expect(monthsLeft(new Date(2026, 8, 27), { month: 7, year: 2026, startDay: 25 })).toBe(4);
  });
});

describe("computeVaultMetrics — FIXED_DEADLINE (Brazil-like)", () => {
  const vault = { goalType: "FIXED_DEADLINE" as const, targetAmount: 2_500_000, targetDate: new Date(2026, 8, 21) };
  const period: VaultPeriod = { month: 7, year: 2026 };

  it("spreads the remaining balance over 3 months (Jul/Aug/Sep)", () => {
    const metrics = computeVaultMetrics(vault, 700_000, period);
    expect(metrics.monthsLeft).toBe(3);
    expect(metrics.requiredThisMonth).toBeCloseTo(600_000);
    expect(metrics.remaining).toBe(1_800_000);
  });
});

describe("classifyVault — FIXED_DEADLINE", () => {
  const vault = { goalType: "FIXED_DEADLINE" as const, targetAmount: 2_500_000, targetDate: new Date(2026, 8, 21) };
  const period: VaultPeriod = { month: 7, year: 2026 };

  it("is Behind when this month's contribution is under the target", () => {
    expect(classifyVault(vault, 700_000, 100_000, period)).toBe("Behind");
  });

  it("is On track once this month's contribution meets the target", () => {
    expect(classifyVault(vault, 700_000, 600_000, period)).toBe("On track");
  });

  it("is Met once balance reaches the target", () => {
    expect(classifyVault(vault, 2_500_000, 0, period)).toBe("Met");
  });

  it("is Overdue once the target date's financial month has passed", () => {
    const pastPeriod: VaultPeriod = { month: 11, year: 2026 };
    expect(classifyVault(vault, 700_000, 0, pastPeriod)).toBe("Overdue");
  });

  it("respects startDay when checking whether the deadline has passed", () => {
    // targetDate Sep 21 belongs to financial September (startDay=25, since
    // 21 < 25). Reporting financial-October (month=10) → already overdue.
    expect(classifyVault(vault, 700_000, 0, { month: 10, year: 2026, startDay: 25 })).toBe("Overdue");
    // Reporting financial-September itself → not yet overdue.
    expect(classifyVault(vault, 700_000, 0, { month: 9, year: 2026, startDay: 25 })).not.toBe("Overdue");
  });
});

describe("classifyVault — RECURRING", () => {
  const vault = { goalType: "RECURRING" as const };
  const period: VaultPeriod = { month: 7, year: 2026 };

  it("is Underfunded when contributions are under the required set-aside", () => {
    expect(classifyVault(vault, 100_000, 100_000, period, 272_350)).toBe("Underfunded");
  });

  it("is On track once contributions meet the required set-aside", () => {
    expect(classifyVault(vault, 300_000, 272_350, period, 272_350)).toBe("On track");
  });
});
