import { getTrends, type TrendsData } from "@/lib/queries/trends";
import { categoryRowStats, sortByAverage } from "@/lib/trend-utils";
import { CategoryTrends, type CategoryColumns } from "./category-trends";
import { HealthScoreCard } from "./health-score-card";
import { IncomeSpendingCard } from "./income-spending-card";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export async function TrendsDashboard({ period = 6 }: { period?: number }) {
  const data = await getTrends(period, { includeCurrent: true });
  return <TrendsView data={data} health={<HealthScoreCard />} />;
}

/** Presentational half, so it can be rendered with fixture data. */
export function TrendsView({ data, health }: { data: TrendsData; health: React.ReactNode }) {
  if (data.months.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        No transactions yet. Trends appear once you start logging.
      </div>
    );
  }

  const flags = data.months.map((m) => m.inProgress);
  const lastComplete = [...data.months].reverse().find((m) => !m.inProgress);
  const running = data.months.find((m) => m.inProgress);
  const completeCount = flags.filter((f) => !f).length;
  const cols: CategoryColumns = {
    avgLabel: `${completeCount}-mo avg`,
    lastLabel: lastComplete ? lastComplete.label.slice(0, 3) : null,
    currentLabel: running ? `${MONTHS_LONG[running.month - 1]} so far` : null,
  };
  const rows = sortByAverage(data.categoryTrends.map((r) => categoryRowStats(r, flags)));

  return (
    <div className="flex flex-col gap-6">
      {health}
      <IncomeSpendingCard months={data.months} />
      <CategoryTrends rows={rows} cols={cols} />
    </div>
  );
}
