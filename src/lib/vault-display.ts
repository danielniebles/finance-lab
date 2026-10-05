// Display helpers for the Vaults page — pure and client-safe (type-only
// imports), so the urgency ordering and "next due" lookup are unit-testable.

import type { VaultWithMetrics } from "@/lib/queries/vaults";
import type { RecurringExpenseRow } from "@/lib/queries/recurring";
import type { VaultStatus } from "@/lib/vault-utils";

/**
 * What's still missing for this month. RECURRING's requiredThisMonth is
 * already netted against the vault balance (which includes this month's
 * contributions), so subtracting contributedThisMonth again would
 * double-count it; other goal types are netted here.
 */
export function stillNeededThisMonth(
  v: Pick<VaultWithMetrics, "goalType" | "requiredThisMonth" | "contributedThisMonth">,
): number {
  return v.goalType === "RECURRING"
    ? v.requiredThisMonth
    : Math.max(0, v.requiredThisMonth - v.contributedThisMonth);
}

const STATUS_RANK: Record<VaultStatus, number> = {
  Overdue: 0,
  Behind: 1,
  Underfunded: 1,
  "On track": 2,
  Open: 3,
  Met: 4,
};

/** Most urgent first: status, then mandatory before leisure, then amount still needed. */
export function sortVaultsByUrgency(vaults: VaultWithMetrics[]): VaultWithMetrics[] {
  return [...vaults].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      Number(b.kind === "MANDATORY") - Number(a.kind === "MANDATORY") ||
      stillNeededThisMonth(b) - stillNeededThisMonth(a),
  );
}

export type NextDue = { name: string; date: Date };

/** The soonest recurring expense each vault funds, keyed by vault id. */
export function nextDueByVault(items: RecurringExpenseRow[]): Map<string, NextDue> {
  const out = new Map<string, NextDue>();
  for (const item of items) {
    if (!item.fundingVaultId) continue;
    const date = new Date(item.nextDueDate);
    const current = out.get(item.fundingVaultId);
    if (!current || date < current.date) out.set(item.fundingVaultId, { name: item.name, date });
  }
  return out;
}

/** Whole days from `from` to `to` (calendar days, ignoring time of day). */
export function daysUntil(to: Date, from: Date = new Date()): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function cadenceLabel(months: number): string {
  switch (months) {
    case 1:
      return "Monthly";
    case 3:
      return "Quarterly";
    case 6:
      return "Semiannual";
    case 12:
      return "Annual";
    default:
      return `Every ${months} months`;
  }
}

/** A vault that still needs action this month (money missing or behind schedule). */
export function needsMoney(v: VaultWithMetrics): boolean {
  return (
    v.status === "Overdue" ||
    v.status === "Behind" ||
    v.status === "Underfunded" ||
    stillNeededThisMonth(v) > 0
  );
}
