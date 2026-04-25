export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { TrendsDashboard } from "@/components/trends/trends-dashboard";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period =
    periodParam === "3" ? 3 :
    periodParam === "12" ? 12 :
    6;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Trends</h1>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading trends…</div>}>
        <TrendsDashboard period={period} />
      </Suspense>
    </div>
  );
}
