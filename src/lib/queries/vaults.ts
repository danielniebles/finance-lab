import { db } from "@/lib/db";
import { VaultKind, VaultGoalType } from "@/generated/prisma";
import {
  classifyVault,
  computeVaultMetrics,
  VaultStatus,
} from "@/lib/vault-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VaultEntryRow = {
  id: string;
  amount: number;
  date: Date;
  notes: string | null;
  createdAt: Date;
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

function currentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function sumEntries(entries: { amount: number }[]): number {
  return entries.reduce((acc, e) => acc + e.amount, 0);
}

function sumEntriesInMonth(
  entries: { amount: number; date: Date }[],
  month: number,
  year: number,
): number {
  return entries
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    })
    .reduce((acc, e) => acc + e.amount, 0);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * All vaults with computed balance + metrics for the current month.
 * Excludes archived vaults by default.
 */
export async function getVaults(
  opts?: { includeArchived?: boolean },
): Promise<VaultWithMetrics[]> {
  const { month, year } = currentMonthYear();

  const rows = await db.vault.findMany({
    where: opts?.includeArchived ? undefined : { archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      entries: { orderBy: { date: "desc" } },
    },
  });

  return rows.map((r) => {
    const balance = sumEntries(r.entries);
    const contributedThisMonth = sumEntriesInMonth(r.entries, month, year);

    const vaultShape = {
      goalType: r.goalType as "FIXED_DEADLINE" | "OPEN_ENDED",
      targetAmount: r.targetAmount,
      targetDate: r.targetDate,
    };

    const metrics = computeVaultMetrics(vaultShape, balance, month, year);
    const status = classifyVault(
      vaultShape,
      balance,
      contributedThisMonth,
      month,
      year,
    );

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
 * Per-vault obligation for a specific month — powers the banner and the agent's
 * read tool. Only includes active (non-archived) FIXED_DEADLINE vaults.
 */
export async function getVaultObligations(
  month: number,
  year: number,
): Promise<VaultObligations> {
  const rows = await db.vault.findMany({
    where: {
      archivedAt: null,
      goalType: "FIXED_DEADLINE",
    },
    orderBy: { createdAt: "asc" },
    include: {
      entries: true,
    },
  });

  const vaults: VaultObligationItem[] = rows.map((r) => {
    const balance = sumEntries(r.entries);
    const contributedThisMonth = sumEntriesInMonth(r.entries, month, year);

    const vaultShape = {
      goalType: r.goalType as "FIXED_DEADLINE" | "OPEN_ENDED",
      targetAmount: r.targetAmount,
      targetDate: r.targetDate,
    };

    const metrics = computeVaultMetrics(vaultShape, balance, month, year);
    const status = classifyVault(
      vaultShape,
      balance,
      contributedThisMonth,
      month,
      year,
    );

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
