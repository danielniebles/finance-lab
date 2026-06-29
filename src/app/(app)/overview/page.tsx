export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";
import { VaultDueBanner } from "@/components/vaults/vault-due-banner";
import { getVaultObligations } from "@/lib/queries/vaults";

export default async function OverviewPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const obligations = await getVaultObligations(month, year);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Overview</h1>
      <VaultDueBanner obligations={obligations} month={month} year={year} />
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading…</div>}>
        <OverviewDashboard />
      </Suspense>
    </div>
  );
}
