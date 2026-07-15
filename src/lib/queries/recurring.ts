import { db } from "@/lib/db";
import { monthlySetAside, monthsUntilDue, isDueInMonth } from "@/lib/recurring-utils";
import { financialMonthYear } from "@/lib/financial-period-utils";

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

function isOverdue(nextDueDate: Date, month: number, year: number, startDay: number): boolean {
  const { month: dMonth, year: dYear } = financialMonthYear(nextDueDate, startDay);
  return dYear < year || (dYear === year && dMonth < month);
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * All active recurring expenses with computed set-aside + status for the
 * given (month, year) — interpreted as a financial month per
 * FINANCIAL_MONTH_START_DAY, matching the Expenses module's convention.
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
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);

  const rows = await db.recurringExpense.findMany({
    where: { active: true },
    orderBy: { nextDueDate: "asc" },
    include: {
      fundingVault: { select: { id: true, name: true, entries: true } },
    },
  });

  const items: RecurringExpenseRow[] = rows.map((r) => {
    const dueDate = r.nextDueDate;
    const overdue = isOverdue(dueDate, month, year, startDay);
    const dueInMonth = isDueInMonth(dueDate, month, year, startDay);
    const setAside = monthlySetAside(r.estimatedAmount, dueDate, month, year, startDay);
    const mUntilDue = monthsUntilDue(dueDate, month, year, startDay);

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
