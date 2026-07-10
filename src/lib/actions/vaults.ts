"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { VaultKind, VaultGoalType } from "@/generated/prisma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function computeBalance(vaultId: string): Promise<number> {
  const result = await db.vaultEntry.aggregate({
    where: { vaultId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

function revalidateVaultPaths() {
  revalidatePath("/vaults");
  revalidatePath("/overview");
  revalidatePath("/loans");
}

// ─── Vault CRUD ───────────────────────────────────────────────────────────────

export async function createVault(data: {
  name: string;
  kind?: VaultKind;
  goalType: VaultGoalType;
  targetAmount?: number | null;
  targetDate?: Date | null;
  color?: string | null;
  notes?: string | null;
}) {
  if (data.goalType === "FIXED_DEADLINE") {
    if (!data.targetAmount || data.targetAmount <= 0) {
      throw new Error(
        "FIXED_DEADLINE vaults require a targetAmount greater than 0.",
      );
    }
    if (!data.targetDate) {
      throw new Error("FIXED_DEADLINE vaults require a targetDate.");
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (data.targetDate <= now) {
      throw new Error("targetDate must be in the future.");
    }
  }

  await db.vault.create({
    data: {
      name: data.name,
      kind: data.kind ?? "LEISURE",
      goalType: data.goalType,
      targetAmount: data.targetAmount ?? null,
      targetDate: data.targetDate ?? null,
      color: data.color ?? null,
      notes: data.notes ?? null,
    },
  });

  revalidateVaultPaths();
}

export async function updateVault(
  id: string,
  data: {
    name?: string;
    kind?: VaultKind;
    goalType?: VaultGoalType;
    targetAmount?: number | null;
    targetDate?: Date | null;
    color?: string | null;
    notes?: string | null;
  },
) {
  // If goalType is being set/kept as FIXED_DEADLINE, validate target fields
  const existing = await db.vault.findUniqueOrThrow({ where: { id } });
  const effectiveGoalType = data.goalType ?? existing.goalType;

  if (effectiveGoalType === "FIXED_DEADLINE") {
    const effectiveTarget =
      "targetAmount" in data ? data.targetAmount : existing.targetAmount;
    const effectiveDate =
      "targetDate" in data ? data.targetDate : existing.targetDate;

    if (!effectiveTarget || effectiveTarget <= 0) {
      throw new Error(
        "FIXED_DEADLINE vaults require a targetAmount greater than 0.",
      );
    }
    if (!effectiveDate) {
      throw new Error("FIXED_DEADLINE vaults require a targetDate.");
    }
  }

  await db.vault.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.kind !== undefined && { kind: data.kind }),
      ...(data.goalType !== undefined && { goalType: data.goalType }),
      ...("targetAmount" in data && { targetAmount: data.targetAmount }),
      ...("targetDate" in data && { targetDate: data.targetDate }),
      ...("color" in data && { color: data.color }),
      ...("notes" in data && { notes: data.notes }),
    },
  });

  revalidateVaultPaths();
}

export async function archiveVault(id: string) {
  await db.vault.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  revalidateVaultPaths();
}

// ─── Vault entries ────────────────────────────────────────────────────────────

/**
 * sourceWalletId (ADR-036/037) defaults to the source account's
 * savingsWalletId when sourceAccountId is set — C1 always funds a vault
 * contribution from the account's savings partition; per-transaction wallet
 * selection is a C2 follow-up (HANDOFF §1).
 */
export async function addVaultEntry(
  vaultId: string,
  amount: number,
  date?: Date,
  notes?: string,
  sourceAccountId?: string | null,
) {
  // Reject withdrawal that would drive balance negative
  if (amount < 0) {
    const balance = await computeBalance(vaultId);
    if (balance + amount < 0) {
      throw new Error(
        `Withdrawal of ${Math.abs(amount)} would exceed current balance of ${balance}.`,
      );
    }
  }

  let sourceWalletId: string | null = null;
  if (sourceAccountId) {
    const account = await db.savingsAccount.findUniqueOrThrow({
      where: { id: sourceAccountId },
      select: { savingsWalletId: true },
    });
    sourceWalletId = account.savingsWalletId;
  }

  await db.vaultEntry.create({
    data: {
      vaultId,
      amount,
      date: date ?? new Date(),
      notes: notes ?? null,
      sourceAccountId: sourceAccountId ?? null,
      sourceWalletId,
    },
  });

  revalidateVaultPaths();
}

export async function deleteVaultEntry(id: string) {
  await db.vaultEntry.delete({ where: { id } });
  revalidateVaultPaths();
}
