import { db } from "@/lib/db";
import { VaultKind, VaultGoalType } from "@/generated/prisma";
import {
  classifyVault,
  computeVaultMetrics,
  VaultStatus,
  type VaultPeriod,
} from "@/lib/vault-utils";
import { monthlySetAside } from "@/lib/recurring-utils";
import { financialMonthYear } from "@/lib/financial-period-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VaultEntryRow = {
  id: string;
  amount: number;
  date: Date;
  notes: string | null;
  createdAt: Date;
  sourceAccountId: string | null;
  sourceAccountName: string | null;
};

export type VaultWithMetrics = {
  id: string;
  name: string;
  kind: VaultKind;
  goalType: VaultGoalType;
  targetAmount: number | null;
  targetDate: Date | null;
  color: string | null;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  entries: VaultEntryRow[];
  // Computed fields
  balance: number;
  remaining: number;
  monthsLeft: number;
  requiredThisMonth: number;
  progressPct: number | null;
  status: VaultStatus;
  contributedThisMonth: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentFinancialPeriod(): VaultPeriod {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { month, year } = financialMonthYear(new Date(), startDay);
  return { month, year, startDay };
}

function sumEntries(entries: { amount: number }[]): number {
  return entries.reduce((acc, e) => acc + e.amount, 0);
}

function sumEntriesInMonth(
  entries: { amount: number; date: Date }[],
  period: VaultPeriod,
): number {
  const { month, year, startDay = 1 } = period;
  return entries
    .filter((e) => {
      const { month: eMonth, year: eYear } = financialMonthYear(new Date(e.date), startDay);
      return eMonth === month && eYear === year;
    })
    .reduce((acc, e) => acc + e.amount, 0);
}

function recurringRequiredFor(
  recurringExpenses: { estimatedAmount: number; nextDueDate: Date }[],
  period: VaultPeriod,
): number {
  const { month, year, startDay = 1 } = period;
  return recurringExpenses.reduce(
    (sum, item) => sum + monthlySetAside(item.estimatedAmount, item.nextDueDate, month, year, startDay),
    0,
  );
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * All vaults with computed balance + metrics for the current financial month
 * (per FINANCIAL_MONTH_START_DAY, matching the Expenses module's convention).
 * Excludes archived vaults by default.
 */
export async function getVaults(
  opts?: { includeArchived?: boolean },
): Promise<VaultWithMetrics[]> {
  const period = currentFinancialPeriod();

  const rows = await db.vault.findMany({
    where: opts?.includeArchived ? undefined : { archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      entries: {
        orderBy: { date: "desc" },
        include: { sourceAccount: { select: { id: true, name: true } } },
      },
      recurringExpenses: { where: { active: true } },
    },
  });

  return rows.map((r) => {
    const balance = sumEntries(r.entries);
    const contributedThisMonth = sumEntriesInMonth(r.entries, period);

    const vaultShape = {
      goalType: r.goalType as "FIXED_DEADLINE" | "OPEN_ENDED" | "RECURRING",
      targetAmount: r.targetAmount,
      targetDate: r.targetDate,
    };

    // For RECURRING vaults, requiredThisMonth = sum of set-asides from linked active expenses
    const recurringRequired =
      r.goalType === "RECURRING" ? recurringRequiredFor(r.recurringExpenses, period) : undefined;

    const metrics = computeVaultMetrics(vaultShape, balance, period, recurringRequired);
    const status = classifyVault(vaultShape, balance, contributedThisMonth, period, recurringRequired);

    return {
      id: r.id,
      name: r.name,
      kind: r.kind,
      goalType: r.goalType,
      targetAmount: r.targetAmount,
      targetDate: r.targetDate,
      color: r.color,
      notes: r.notes,
      archivedAt: r.archivedAt,
      createdAt: r.createdAt,
      entries: r.entries.map((e) => ({
        id: e.id,
        amount: e.amount,
        date: e.date,
        notes: e.notes,
        createdAt: e.createdAt,
        sourceAccountId: e.sourceAccountId,
        sourceAccountName: e.sourceAccount?.name ?? null,
      })),
      balance,
      remaining: metrics.remaining,
      monthsLeft: metrics.monthsLeft,
      requiredThisMonth: metrics.requiredThisMonth,
      progressPct: metrics.progressPct,
      status,
      contributedThisMonth,
    };
  });
}

// ─── Vault obligations ────────────────────────────────────────────────────────

export type VaultObligationItem = {
  id: string;
  name: string;
  kind: VaultKind;
  goalType: VaultGoalType;
  requiredThisMonth: number;
  contributedThisMonth: number;
  stillNeeded: number;
  status: VaultStatus;
  progressPct: number | null;
};

export type VaultObligations = {
  vaults: VaultObligationItem[];
  totalRequired: number;
  totalStillNeeded: number;
  mandatoryStillNeeded: number;
};

/**
 * Per-vault obligation for a specific (financial) month — powers the banner
 * and the agent's read tool. Only includes active (non-archived)
 * FIXED_DEADLINE and RECURRING vaults.
 */
export async function getVaultObligations(
  month: number,
  year: number,
): Promise<VaultObligations> {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const period: VaultPeriod = { month, year, startDay };

  const rows = await db.vault.findMany({
    where: {
      archivedAt: null,
      goalType: { in: ["FIXED_DEADLINE", "RECURRING"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      entries: true,
      recurringExpenses: { where: { active: true } },
    },
  });

  const vaults: VaultObligationItem[] = rows.map((r) => {
    const balance = sumEntries(r.entries);
    const contributedThisMonth = sumEntriesInMonth(r.entries, period);

    const vaultShape = {
      goalType: r.goalType as "FIXED_DEADLINE" | "OPEN_ENDED" | "RECURRING",
      targetAmount: r.targetAmount,
      targetDate: r.targetDate,
    };

    const recurringRequired =
      r.goalType === "RECURRING" ? recurringRequiredFor(r.recurringExpenses, period) : undefined;

    const metrics = computeVaultMetrics(vaultShape, balance, period, recurringRequired);
    const status = classifyVault(vaultShape, balance, contributedThisMonth, period, recurringRequired);

    const stillNeeded = Math.max(
      0,
      metrics.requiredThisMonth - contributedThisMonth,
    );

    return {
      id: r.id,
      name: r.name,
      kind: r.kind,
      goalType: r.goalType,
      requiredThisMonth: metrics.requiredThisMonth,
      contributedThisMonth,
      stillNeeded,
      status,
      progressPct: metrics.progressPct,
    };
  });

  const totalRequired = vaults.reduce((s, v) => s + v.requiredThisMonth, 0);
  const totalStillNeeded = vaults.reduce((s, v) => s + v.stillNeeded, 0);
  const mandatoryStillNeeded = vaults
    .filter((v) => v.kind === "MANDATORY")
    .reduce((s, v) => s + v.stillNeeded, 0);

  return { vaults, totalRequired, totalStillNeeded, mandatoryStillNeeded };
}
