"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { rollCycle } from "@/lib/recurring-utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidatePaths() {
  revalidatePath("/vaults");
  revalidatePath("/overview");
}

/**
 * The Advisor still proposes recurring expenses with a free-text category;
 * link it to the matching category when the name matches one (ADR-050).
 */
async function categoryIdForLabel(label: string | null | undefined): Promise<string | null> {
  const name = label?.trim();
  if (!name) return null;
  const match = await db.appCategory.findFirst({
    where: { isTransfer: false, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return match?.id ?? null;
}

function validateNewRecurring(data: { name: string; estimatedAmount: number; cadenceMonths: number; nextDueDate: Date }) {
  if (!data.name || data.name.trim() === "") throw new Error("name is required.");
  if (!data.estimatedAmount || data.estimatedAmount <= 0) throw new Error("estimatedAmount must be greater than 0.");
  if (!data.cadenceMonths || data.cadenceMonths < 1) throw new Error("cadenceMonths must be at least 1.");
  if (!(data.nextDueDate instanceof Date) || isNaN(data.nextDueDate.getTime())) {
    throw new Error("nextDueDate must be a valid date.");
  }
}

type RecurringUpdate = {
  name?: string;
  estimatedAmount?: number;
  cadenceMonths?: number;
  nextDueDate?: Date;
  category?: string | null;
  appCategoryId?: string | null;
  fundingVaultId?: string | null;
  active?: boolean;
  notes?: string | null;
};

function validateRecurringUpdate(data: RecurringUpdate) {
  if (data.estimatedAmount !== undefined && data.estimatedAmount <= 0) {
    throw new Error("estimatedAmount must be greater than 0.");
  }
  if (data.cadenceMonths !== undefined && data.cadenceMonths < 1) {
    throw new Error("cadenceMonths must be at least 1.");
  }
  if (data.nextDueDate !== undefined && (!(data.nextDueDate instanceof Date) || isNaN(data.nextDueDate.getTime()))) {
    throw new Error("nextDueDate must be a valid date.");
  }
}

/** Prisma skips `undefined` fields, so only the keys the caller passed change. */
function recurringUpdateData(data: RecurringUpdate): RecurringUpdate {
  return { ...data, name: data.name?.trim() };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createRecurringExpense(data: {
  name: string;
  estimatedAmount: number;
  cadenceMonths: number;
  nextDueDate: Date;
  category?: string | null;
  appCategoryId?: string | null;
  fundingVaultId?: string | null;
  notes?: string | null;
}) {
  validateNewRecurring(data);

  await db.recurringExpense.create({
    data: {
      name: data.name.trim(),
      estimatedAmount: data.estimatedAmount,
      cadenceMonths: data.cadenceMonths,
      nextDueDate: data.nextDueDate,
      category: data.category ?? null,
      appCategoryId: data.appCategoryId ?? (await categoryIdForLabel(data.category)),
      fundingVaultId: data.fundingVaultId ?? null,
      notes: data.notes ?? null,
    },
  });

  revalidatePaths();
}

export async function updateRecurringExpense(id: string, data: RecurringUpdate) {
  validateRecurringUpdate(data);
  await db.recurringExpense.update({ where: { id }, data: recurringUpdateData(data) });
  revalidatePaths();
}

export async function deleteRecurringExpense(id: string) {
  await db.recurringExpense.delete({ where: { id } });
  revalidatePaths();
}

// ─── Payment (atomic) ─────────────────────────────────────────────────────────

export async function payRecurringExpense(
  id: string,
  {
    amount,
    fromVaultId,
  }: {
    amount: number;
    fromVaultId?: string;
  },
) {
  if (!amount || amount <= 0) {
    throw new Error("amount must be greater than 0.");
  }

  await db.$transaction(async (tx) => {
    // 1. Fetch the recurring expense
    const expense = await tx.recurringExpense.findUniqueOrThrow({
      where: { id },
    });

    const currentNextDueDate = expense.nextDueDate;
    const newNextDueDate = rollCycle(currentNextDueDate, expense.cadenceMonths);

    let vaultEntryId: string | null = null;

    // 2. If fromVaultId: create a vault withdrawal entry
    if (fromVaultId) {
      // Check balance before withdrawing
      const agg = await tx.vaultEntry.aggregate({
        where: { vaultId: fromVaultId },
        _sum: { amount: true },
      });
      const balance = agg._sum.amount ?? 0;
      if (balance + -amount < 0) {
        throw new Error(
          `Withdrawal of ${amount} would exceed current vault balance of ${balance}.`,
        );
      }

      const entry = await tx.vaultEntry.create({
        data: {
          vaultId: fromVaultId,
          amount: -amount,
          date: new Date(),
          notes: `Payment for: ${expense.name}`,
        },
      });
      vaultEntryId = entry.id;
    }

    // 3. Create the payment record
    await tx.recurringExpensePayment.create({
      data: {
        recurringExpenseId: id,
        amount,
        dueDate: currentNextDueDate,
        paidAt: new Date(),
        vaultEntryId,
      },
    });

    // 4. Roll the cycle forward
    await tx.recurringExpense.update({
      where: { id },
      data: { nextDueDate: newNextDueDate },
    });
  });

  revalidatePaths();
}
