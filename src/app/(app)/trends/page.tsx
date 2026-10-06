export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { TrendsDashboard } from "@/components/trends/trends-dashboard";
import { PeriodToggle } from "@/components/trends/period-toggle";
import { PageHeader } from "@/components/ds";

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
      <PageHeader
        title="Trends"
        description={`How the last ${PERIOD_WORDS[period]} months compare`}
        controls={<PeriodToggle current={period} />}
      />
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading trends…</div>}>
        <TrendsDashboard period={period} />
      </Suspense>
    </div>
  );
}
