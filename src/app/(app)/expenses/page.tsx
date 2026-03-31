export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getImportBatches } from "@/lib/queries/expenses";
import { ImportForm } from "@/components/expenses/import-form";
import { AnalysisDashboard } from "@/components/expenses/analysis-dashboard";
import { PeriodSelector } from "@/components/expenses/period-selector";

type Props = {
  searchParams: Promise<{ month?: string; year?: string }>;
};

export default async function ExpensesPage({ searchParams }: Props) {
  const params = await searchParams;
  const batches = await getImportBatches();
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);

  const selectedMonth = params.month ? parseInt(params.month) : batches[0]?.month;
  const selectedYear = params.year ? parseInt(params.year) : batches[0]?.year;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <ImportForm />
      </div>

      {batches.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          No data yet. Import a MoneyLover export to get started.
        </div>
      ) : (
        <>
          <PeriodSelector
            batches={batches}
            selectedMonth={selectedMonth!}
            selectedYear={selectedYear!}
            startDay={startDay}
          />
          <Suspense
            fallback={
              <div className="text-muted-foreground text-sm">Loading analysis…</div>
            }
          >
            <AnalysisDashboard month={selectedMonth!} year={selectedYear!} />
          </Suspense>
        </>
      )}
    </div>
  );
}
