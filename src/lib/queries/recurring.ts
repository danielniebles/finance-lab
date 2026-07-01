import { db } from "@/lib/db";
import { monthlySetAside, isDueInMonth } from "@/lib/recurring-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecurringExpenseRow = {
  id: string;
  name: string;
  estimatedAmount: number;
  cadenceMonths: number;
  nextDueDate: Date;
  category: string | null;
  fundingVaultId: string | null;
  fundingVaultName: string | null;
  monthsUntilDue: number;
  setAsideThisMonth: number;
  dueThisMonth: boolean;
  status: "Funded" | "Underfunded" | "DueSoon" | "Overdue";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthsUntilDueFromNow(nextDueDate: Date, month: number, year: number): number {
  const dYear = nextDueDate.getFullYear();
  const dMonth = nextDueDate.getMonth() + 1;
  const diff = (dYear - year) * 12 + (dMonth - month);
  return Math.max(1, diff);
}

function isOverdue(nextDueDate: Date, month: number, year: number): boolean {
  const dYear = nextDueDate.getFullYear();
  const dMonth = nextDueDate.getMonth() + 1;
  return dYear < year || (dYear === year && dMonth < month);
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * All active recurring expenses with computed set-aside + status for the month.
 */
export async function getRecurringExpenses(
  month: number,
  year: number,
): Promise<{
  items: RecurringExpenseRow[];
  totalSetAsideThisMonth: number;
  dueThisMonth: RecurringExpenseRow[];
  next90Days: RecurringExpenseRow[];
}> {
  const rows = await db.recurringExpense.findMany({
    where: { active: true },
    orderBy: { nextDueDate: "asc" },
    include: {
      fundingVault: { select: { id: true, name: true, entries: true } },
    },
  });

  const items: RecurringExpenseRow[] = rows.map((r) => {
    const dueDate = r.nextDueDate;
    const overdue = isOverdue(dueDate, month, year);
    const dueInMonth = isDueInMonth(dueDate, month, year);
    const setAside = monthlySetAside(r.estimatedAmount, dueDate, month, year);
    const mUntilDue = monthsUntilDueFromNow(dueDate, month, year);

    // Compute vault balance if there's a funding vault
    const vaultBalance = r.fundingVault
      ? r.fundingVault.entries.reduce((sum, e) => sum + e.amount, 0)
      : null;

    let status: RecurringExpenseRow["status"];
    if (overdue) {
      status = "Overdue";
    } else if (dueInMonth) {
      status = "DueSoon";
    } else if (
      r.fundingVaultId !== null &&
      vaultBalance !== null &&
      vaultBalance >= r.estimatedAmount
    ) {
      status = "Funded";
    } else {
      status = "Underfunded";
    }

    return {
      id: r.id,
      name: r.name,
      estimatedAmount: r.estimatedAmount,
      cadenceMonths: r.cadenceMonths,
      nextDueDate: dueDate,
      category: r.category,
      fundingVaultId: r.fundingVaultId,
      fundingVaultName: r.fundingVault?.name ?? null,
      monthsUntilDue: mUntilDue,
      setAsideThisMonth: setAside,
      dueThisMonth: dueInMonth,
      status,
    };
  });

  const totalSetAsideThisMonth = items.reduce((s, i) => s + i.setAsideThisMonth, 0);
  const dueThisMonth = items.filter((i) => i.dueThisMonth || i.status === "Overdue");

  // next90Days: items with nextDueDate within 90 days from today
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + 90);
  const next90Days = items.filter(
    (i) => i.nextDueDate >= now && i.nextDueDate <= cutoff,
  );

  return { items, totalSetAsideThisMonth, dueThisMonth, next90Days };
}
