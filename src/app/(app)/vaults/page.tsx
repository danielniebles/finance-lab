export const dynamic = "force-dynamic";

import { VaultsDashboard } from "@/components/vaults/vaults-dashboard";
import { getVaults, getVaultObligations } from "@/lib/queries/vaults";
import { getRecurringExpenses } from "@/lib/queries/recurring";

export default async function VaultsPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [vaults, obligations, recurringData] = await Promise.all([
    getVaults(),
    getVaultObligations(month, year),
    getRecurringExpenses(month, year),
  ]);

  const recurringVaults = vaults.filter((v) => v.goalType === "RECURRING");

  return (
    <VaultsDashboard
      vaults={vaults}
      obligations={obligations}
      recurringData={recurringData}
      recurringVaults={recurringVaults}
      month={month}
      year={year}
    />
  );
}
