export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { TrendsDashboard } from "@/components/trends/trends-dashboard";
import { PeriodToggle } from "@/components/trends/period-toggle";

const PERIOD_WORDS: Record<number, string> = { 3: "three", 6: "six", 12: "twelve" };

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = periodParam === "3" ? 3 : periodParam === "12" ? 12 : 6;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Trends</h1>
          <p className="text-sm text-muted-foreground">How the last {PERIOD_WORDS[period]} months compare</p>
        </div>
        <PeriodToggle current={period} />
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading trends…</div>}>
        <TrendsDashboard period={period} />
      </Suspense>
    </div>
  );
}
