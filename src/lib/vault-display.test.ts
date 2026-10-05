import { describe, expect, it } from "vitest";
import type { VaultWithMetrics } from "@/lib/queries/vaults";
import type { RecurringExpenseRow } from "@/lib/queries/recurring";
import { daysUntil, needsMoney, nextDueByVault, sortVaultsByUrgency, stillNeededThisMonth } from "./vault-display";

function vault(o: Partial<VaultWithMetrics>): VaultWithMetrics {
  return {
    id: o.name ?? "v",
    name: "V",
    kind: "LEISURE",
    goalType: "RECURRING",
    targetAmount: null,
    targetDate: null,
    color: null,
    notes: null,
    archivedAt: null,
    createdAt: new Date(),
    entries: [],
    balance: 0,
    remaining: 0,
    monthsLeft: 0,
    requiredThisMonth: 0,
    progressPct: null,
    status: "On track",
    contributedThisMonth: 0,
    ...o,
  } as VaultWithMetrics;
}

describe("stillNeededThisMonth", () => {
  it("doesn't double-count contributions for recurring vaults", () => {
    expect(stillNeededThisMonth(vault({ requiredThisMonth: 100, contributedThisMonth: 40 }))).toBe(100);
  });
  it("nets contributions for goals", () => {
    expect(stillNeededThisMonth(vault({ goalType: "FIXED_DEADLINE", requiredThisMonth: 100, contributedThisMonth: 40 }))).toBe(60);
    expect(stillNeededThisMonth(vault({ goalType: "FIXED_DEADLINE", requiredThisMonth: 100, contributedThisMonth: 140 }))).toBe(0);
  });
});

describe("sortVaultsByUrgency", () => {
  it("orders overdue, then mandatory, then by amount; met last", () => {
    const sorted = sortVaultsByUrgency([
      vault({ name: "Met", status: "Met" }),
      vault({ name: "Gifts", status: "Underfunded", requiredThisMonth: 675_000 }),
      vault({ name: "Skin", status: "Underfunded", requiredThisMonth: 400_000 }),
      vault({ name: "Car", status: "Underfunded", kind: "MANDATORY", requiredThisMonth: 63_400 }),
      vault({ name: "Late", status: "Overdue" }),
    ]);
    expect(sorted.map((v) => v.name)).toEqual(["Late", "Car", "Gifts", "Skin", "Met"]);
  });
});

describe("nextDueByVault", () => {
  const item = (name: string, vaultId: string | null, date: string) =>
    ({ name, fundingVaultId: vaultId, nextDueDate: new Date(date) }) as RecurringExpenseRow;

  it("keeps the soonest expense per vault and skips unfunded ones", () => {
    const map = nextDueByVault([
      item("Mom's Birthday", "gifts", "2026-12-28"),
      item("Maria's Birthday", "gifts", "2026-10-10"),
      item("No vault", null, "2026-10-01"),
    ]);
    expect(map.get("gifts")?.name).toBe("Maria's Birthday");
    expect(map.size).toBe(1);
  });
});

describe("daysUntil", () => {
  it("counts calendar days", () => {
    expect(daysUntil(new Date(2026, 9, 10, 1), new Date(2026, 9, 5, 23))).toBe(5);
    expect(daysUntil(new Date(2026, 9, 5), new Date(2026, 9, 5, 18))).toBe(0);
  });
});

describe("needsMoney", () => {
  it("flags vaults behind or still missing money this month", () => {
    expect(needsMoney(vault({ status: "Underfunded" }))).toBe(true);
    expect(needsMoney(vault({ status: "Overdue" }))).toBe(true);
    expect(needsMoney(vault({ status: "On track", requiredThisMonth: 10 }))).toBe(true);
    expect(needsMoney(vault({ status: "Met" }))).toBe(false);
    expect(needsMoney(vault({ status: "Open", goalType: "OPEN_ENDED" }))).toBe(false);
  });
});
