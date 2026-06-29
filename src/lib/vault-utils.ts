// Pure math utilities for the Vaults module — client-safe, no DB imports.
// Mirror of installment-utils.ts pattern.

export type VaultStatus = "Met" | "On track" | "Behind" | "Overdue" | "Open";

/** Minimal vault shape needed by the math functions (avoids importing Prisma types here). */
export type VaultShape = {
  goalType: "FIXED_DEADLINE" | "OPEN_ENDED";
  targetAmount?: number | null;
  targetDate?: Date | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Whole months remaining from the first day of (month, year) through targetDate.
 * "Through" means: if targetDate is in June and current month is June → 1.
 * Minimum return value is 1 (so requiredThisMonth is never Infinity).
 */
export function monthsLeft(
  targetDate: Date,
  month: number,
  year: number,
): number {
  // Treat targetDate as UTC to avoid timezone shifts
  const tYear = targetDate.getFullYear();
  const tMonth = targetDate.getMonth() + 1; // 1-based

  const diff = (tYear - year) * 12 + (tMonth - month);
  return Math.max(1, diff + 1); // +1: include the current month
}

// ─── Core metrics ─────────────────────────────────────────────────────────────

export type VaultMetrics = {
  balance: number;
  remaining: number;         // FIXED_DEADLINE only, else 0
  monthsLeft: number;        // FIXED_DEADLINE only, else 0
  requiredThisMonth: number; // FIXED_DEADLINE only, else 0
  progressPct: number | null; // balance / targetAmount * 100, null for OPEN_ENDED without target
};

/**
 * Computes derived metrics for a vault given its current balance and the
 * reporting month/year.  Pure — no DB access.
 */
export function computeVaultMetrics(
  vault: VaultShape,
  balance: number,
  month: number,
  year: number,
): VaultMetrics {
  if (vault.goalType === "OPEN_ENDED") {
    const progressPct =
      vault.targetAmount && vault.targetAmount > 0
        ? (balance / vault.targetAmount) * 100
        : null;
    return {
      balance,
      remaining: 0,
      monthsLeft: 0,
      requiredThisMonth: 0,
      progressPct,
    };
  }

  // FIXED_DEADLINE
  const target = vault.targetAmount ?? 0;
  const remaining = Math.max(0, target - balance);
  const ml =
    vault.targetDate ? monthsLeft(vault.targetDate, month, year) : 1;
  const requiredThisMonth = ml > 0 ? remaining / ml : 0;
  const progressPct = target > 0 ? (balance / target) * 100 : null;

  return {
    balance,
    remaining,
    monthsLeft: ml,
    requiredThisMonth,
    progressPct,
  };
}

// ─── Status classification ────────────────────────────────────────────────────

/**
 * Classifies a vault's status for the given month/year.
 * Rules from docs/agent.md §5:
 *   Met     — balance >= targetAmount
 *   Overdue — targetDate is past and balance < targetAmount
 *   Behind  — contributedThisMonth < requiredThisMonth and targetDate not past
 *   On track — otherwise (FIXED_DEADLINE)
 *   Open    — OPEN_ENDED
 */
export function classifyVault(
  vault: VaultShape,
  balance: number,
  contributedThisMonth: number,
  month: number,
  year: number,
): VaultStatus {
  if (vault.goalType === "OPEN_ENDED") return "Open";

  const target = vault.targetAmount ?? 0;

  if (balance >= target) return "Met";

  // Check if deadline has passed
  if (vault.targetDate) {
    const tYear = vault.targetDate.getFullYear();
    const tMonth = vault.targetDate.getMonth() + 1;
    const isPast =
      tYear < year || (tYear === year && tMonth < month);
    if (isPast) return "Overdue";
  }

  const metrics = computeVaultMetrics(vault, balance, month, year);
  if (contributedThisMonth < metrics.requiredThisMonth) return "Behind";

  return "On track";
}
