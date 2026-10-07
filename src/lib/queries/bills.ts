import { db } from "@/lib/db";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { localISODate } from "@/lib/form-format";
import { billStatuses, type BillStatus, type UnlinkedSpend } from "@/lib/bill-display";

export type BillsForMonth = {
  month: number;
  year: number;
  /** The period is still running — Pay bills is offered only then. */
  open: boolean;
  /** Period bounds as "YYYY-MM-DD", end exclusive. */
  startISO: string;
  endISO: string;
  bills: BillStatus[];
  unlinked: UnlinkedSpend[];
};

/** Every bill with its paid status for a financial month (ADR-052, rules in lib/bill-display). */
export async function getBills(month: number, year: number): Promise<BillsForMonth> {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);

  const [items, expenses] = await Promise.all([
    db.budgetItem.findMany({
      where: { appCategory: { isTransfer: false } },
      select: {
        id: true,
        name: true,
        amount: true,
        budgetType: true,
        isBill: true,
        appCategory: { select: { id: true, name: true, icon: true, color: true } },
      },
    }),
    db.transaction.findMany({
      where: { date: { gte: start, lt: end }, isTransfer: false, amount: { lt: 0 }, appCategoryId: { not: null } },
      select: { amount: true, date: true, appCategoryId: true, budgetItemId: true },
    }),
  ]);

  const { bills, unlinked } = billStatuses(
    items.map(({ appCategory, ...i }) => ({ ...i, category: appCategory })),
    expenses,
  );
  return {
    month,
    year,
    open: new Date() < end,
    startISO: localISODate(start),
    endISO: localISODate(end),
    bills,
    unlinked,
  };
}
