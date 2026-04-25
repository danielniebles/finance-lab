export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Overview</h1>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading…</div>}>
        <OverviewDashboard />
      </Suspense>
    </div>
  );
}
