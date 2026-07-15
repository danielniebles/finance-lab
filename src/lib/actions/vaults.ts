"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { VaultKind, VaultGoalType, TransactionSource } from "@/generated/prisma";

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

function revalidateExpensesPaths() {
  revalidatePath("/expenses");
  revalidatePath("/trends");
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
 * Two ways to fund a contribution:
 *
 * - walletId + appCategoryId: creates a real, categorized Transaction
 *   (negative amount) alongside the VaultEntry, linked via transactionId.
 *   The wallet's balance drops through the normal transaction sum — this
 *   money genuinely left the wallet for a purpose, same as any other spend.
 * - sourceAccountId only (legacy/notional): no Transaction is created;
 *   sourceWalletId defaults to the account's savingsWalletId and is
 *   subtracted as an "earmarked out" adjustment (wallet-balance-utils.ts).
 *   Kept for entries with no specific wallet/category to attribute to.
 *
 * Withdrawals never create a Transaction (out of scope — money leaving a
 * vault back to a wallet isn't a categorized expense).
 */
export async function addVaultEntry(
  vaultId: string,
  amount: number,
  opts?: {
    date?: Date;
    notes?: string;
    sourceAccountId?: string | null;
    walletId?: string | null;
    appCategoryId?: string | null;
  },
) {
  const { date, notes, sourceAccountId, walletId, appCategoryId } = opts ?? {};

  // Reject withdrawal that would drive balance negative
  if (amount < 0) {
    const balance = await computeBalance(vaultId);
    if (balance + amount < 0) {
      throw new Error(
        `Withdrawal of ${Math.abs(amount)} would exceed current balance of ${balance}.`,
      );
    }
  }

  const entryDate = date ?? new Date();

  if (walletId && appCategoryId && amount > 0) {
    const wallet = await db.wallet.findUniqueOrThrow({
      where: { id: walletId },
      select: { accountId: true, name: true },
    });

    await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          amount: -amount,
          date: entryDate,
          appCategoryId,
          wallet: wallet.name,
          walletId,
          note: notes ?? null,
          source: TransactionSource.MANUAL,
        },
      });
      await tx.vaultEntry.create({
        data: {
          vaultId,
          amount,
          date: entryDate,
          notes: notes ?? null,
          sourceAccountId: wallet.accountId,
          sourceWalletId: walletId,
          transactionId: transaction.id,
        },
      });
    });

    revalidateVaultPaths();
    revalidateExpensesPaths();
    return;
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
      date: entryDate,
      notes: notes ?? null,
      sourceAccountId: sourceAccountId ?? null,
      sourceWalletId,
    },
  });

  revalidateVaultPaths();
}

/**
 * Deletes a vault entry. If it funded a real Transaction (wallet + category
 * contribution), deletes that too — otherwise the wallet balance stays
 * short the amount even though the vault no longer claims it.
 */
export async function deleteVaultEntry(id: string) {
  const entry = await db.vaultEntry.findUniqueOrThrow({
    where: { id },
    select: { transactionId: true },
  });

  await db.$transaction(async (tx) => {
    await tx.vaultEntry.delete({ where: { id } });
    if (entry.transactionId) {
      await tx.transaction.delete({ where: { id: entry.transactionId } });
    }
  });

  revalidateVaultPaths();
  if (entry.transactionId) revalidateExpensesPaths();
}
