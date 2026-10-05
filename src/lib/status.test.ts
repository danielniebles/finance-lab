import { describe, expect, it } from "vitest";
import {
  TONE_CLASSES,
  toneForBudgetUsed,
  toneForCategorySeverity,
  toneForRecurringStatus,
  toneForSavingsRate,
  toneForVaultStatus,
} from "./status";

describe("status tones", () => {
  it("maps category severity", () => {
    expect(toneForCategorySeverity("OK")).toBe("positive");
    expect(toneForCategorySeverity("Issue")).toBe("caution");
    expect(toneForCategorySeverity("Critical")).toBe("danger");
    expect(toneForCategorySeverity("Unplanned")).toBe("unplanned");
  });

  it("maps vault status the way the vault screens already did", () => {
    expect(toneForVaultStatus("Met")).toBe("positive");
    expect(toneForVaultStatus("On track")).toBe("positive");
    expect(toneForVaultStatus("Behind")).toBe("caution");
    expect(toneForVaultStatus("Underfunded")).toBe("caution");
    expect(toneForVaultStatus("Overdue")).toBe("danger");
    expect(toneForVaultStatus("Open")).toBe("neutral");
  });

  it("maps recurring-expense status", () => {
    expect(toneForRecurringStatus("Funded")).toBe("positive");
    expect(toneForRecurringStatus("DueSoon")).toBe("caution");
    expect(toneForRecurringStatus("Overdue")).toBe("danger");
  });

  it("grades budget use at 80% and 100%", () => {
    expect(toneForBudgetUsed(79.9)).toBe("positive");
    expect(toneForBudgetUsed(80)).toBe("caution");
    expect(toneForBudgetUsed(100)).toBe("danger");
  });

  it("grades savings rate against the 20% target", () => {
    expect(toneForSavingsRate(null)).toBe("neutral");
    expect(toneForSavingsRate(2.6)).toBe("danger");
    expect(toneForSavingsRate(12.8)).toBe("caution");
    expect(toneForSavingsRate(20)).toBe("positive");
  });

  it("only uses theme tokens, never raw palette colors", () => {
    const all = Object.values(TONE_CLASSES).flatMap((t) => Object.values(t)).join(" ");
    expect(all).not.toMatch(/(red|green|amber|emerald|yellow|blue)-\d{3}|oklch\(|#[0-9a-f]{3,6}/i);
  });
});
