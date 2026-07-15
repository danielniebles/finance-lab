// Pure math utilities for the Vaults module — client-safe, no DB imports.
// Mirror of installment-utils.ts pattern.

import { financialMonthYear } from "./financial-period-utils";

export type VaultStatus = "Met" | "On track" | "Behind" | "Overdue" | "Open" | "Underfunded";

/** Minimal vault shape needed by the math functions (avoids importing Prisma types here). */
export type VaultShape = {
  goalType: "FIXED_DEADLINE" | "OPEN_ENDED" | "RECURRING";
  targetAmount?: number | null;
  targetDate?: Date | null;
};

/**
 * The reporting period every math function below is evaluated against.
 * `startDay` is FINANCIAL_MONTH_START_DAY — pass it to interpret (month, year)
 * and any dates as financial months (e.g. startDay=25 means the period for
 * financial month "March" runs Feb 25 → Mar 24), matching the Expenses
 * module's convention. Defaults to 1 (plain calendar months).
 */
export type VaultPeriod = { month: number; year: number; startDay?: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Whole (financial) months remaining from the period through targetDate,
 * inclusive of the current month. targetDate is first classified via
 * financialMonthYear(startDay), so a mid-month startDay shifts late-month
 * target dates into the next financial month, same as everywhere else in the
 * app. Minimum return value is 1 (so requiredThisMonth is never Infinity).
 *
 * "Inclusive of the current month" means: if targetDate is in the same
 * financial month, diff = 0 → we return 1; if it's in the next financial
 * month, diff = 1 → we return 2 (spread over this month + next).
 */
export function monthsLeft(targetDate: Date, period: VaultPeriod): number {
  const { month, year, startDay = 1 } = period;
  const { month: tMonth, year: tYear } = financialMonthYear(targetDate, startDay);

  const diff = (tYear - year) * 12 + (tMonth - month);
  return Math.max(1, diff + 1); // +1: include the current month
}

function isTargetDatePast(targetDate: Date, period: VaultPeriod): boolean {
  const { month, year, startDay = 1 } = period;
  const { month: tMonth, year: tYear } = financialMonthYear(targetDate, startDay);
  return tYear < year || (tYear === year && tMonth < month);
}

// ─── Core metrics ─────────────────────────────────────────────────────────────

export type VaultMetrics = {
  balance: number;
  remaining: number;          // FIXED_DEADLINE only, else 0
  monthsLeft: number;         // FIXED_DEADLINE only, else 0
  requiredThisMonth: number;  // FIXED_DEADLINE: remaining/monthsLeft; RECURRING: passed in; OPEN_ENDED: 0
  progressPct: number | null; // balance / targetAmount * 100; null for OPEN_ENDED without target and RECURRING
};

/**
 * Computes derived metrics for a vault given its current balance and
 * reporting period. Pure — no DB access.
 *
 * For RECURRING vaults, requiredThisMonth must be passed in by the caller
 * (computed from linked recurring expenses). Pass 0 if unknown.
 */
export function computeVaultMetrics(
  vault: VaultShape,
  balance: number,
  period: VaultPeriod,
  recurringRequired?: number,
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

  if (vault.goalType === "RECURRING") {
    return {
      balance,
      remaining: 0,
      monthsLeft: 0,
      requiredThisMonth: recurringRequired ?? 0,
      progressPct: null,
    };
  }

  // FIXED_DEADLINE
  const target = vault.targetAmount ?? 0;
  const remaining = Math.max(0, target - balance);
  const ml = vault.targetDate ? monthsLeft(vault.targetDate, period) : 1;
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
 * Classifies a vault's status for the given reporting period.
 * Rules from docs/agent.md §5:
 *   Met          — balance >= targetAmount (FIXED_DEADLINE)
 *   Overdue      — targetDate is past and balance < targetAmount
 *   Behind       — contributedThisMonth < requiredThisMonth and targetDate not past
 *   On track     — otherwise (FIXED_DEADLINE)
 *   Open         — OPEN_ENDED
 *   Underfunded  — RECURRING: contributedThisMonth < requiredThisMonth
 *
 * For RECURRING vaults, pass requiredThisMonth computed from linked expenses.
 */
export function classifyVault(
  vault: VaultShape,
  balance: number,
  contributedThisMonth: number,
  period: VaultPeriod,
  requiredThisMonth?: number,
): VaultStatus {
  if (vault.goalType === "OPEN_ENDED") return "Open";

  if (vault.goalType === "RECURRING") {
    const required = requiredThisMonth ?? 0;
    return contributedThisMonth < required ? "Underfunded" : "On track";
  }

  const target = vault.targetAmount ?? 0;

  if (balance >= target) return "Met";

  if (vault.targetDate && isTargetDatePast(vault.targetDate, period)) return "Overdue";

  const metrics = computeVaultMetrics(vault, balance, period);
  if (contributedThisMonth < metrics.requiredThisMonth) return "Behind";

  return "On track";
}
