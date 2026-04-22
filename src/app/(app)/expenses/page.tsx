export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ImportForm } from "@/components/expenses/import-form";
import { AnalysisDashboard } from "@/components/expenses/analysis-dashboard";
import { PeriodSelector } from "@/components/expenses/period-selector";
import { db } from "@/lib/db";

type Props = {
  searchParams: Promise<{ month?: string; year?: string }>;
};

function currentFinancialMonth(startDay: number) {
  const today = new Date();
  const day = today.getDate();
  let month = today.getMonth() + 1;
  let year = today.getFullYear();
  if (day >= startDay) {
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return { month, year };
}

export default async function ExpensesPage({ searchParams }: Props) {
  const params = await searchParams;
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const fallback = currentFinancialMonth(startDay);

  const selectedMonth = params.month ? parseInt(params.month) : fallback.month;
  const selectedYear = params.year ? parseInt(params.year) : fallback.year;

  const importedMonths = await db.importBatch.findMany({
    select: { month: true, year: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-heading text-2xl font-semibold">Expenses</h1>
        <div className="flex items-center gap-3">
          <PeriodSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            startDay={startDay}
            availableMonths={importedMonths}
          />
          <ImportForm />
        </div>
      </div>

      <Suspense
        fallback={
          <div className="text-muted-foreground text-sm">Loading analysis…</div>
        }
      >
        <AnalysisDashboard month={selectedMonth} year={selectedYear} />
      </Suspense>
    </div>
  );
}
