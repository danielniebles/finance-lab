export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { TrendsDashboard } from "@/components/trends/trends-dashboard";

export default function TrendsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Trends</h1>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading trends…</div>}>
        <TrendsDashboard />
      </Suspense>
    </div>
  );
}
