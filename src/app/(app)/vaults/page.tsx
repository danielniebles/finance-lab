export const dynamic = "force-dynamic";

import { VaultsDashboard } from "@/components/vaults/vaults-dashboard";
import { getVaults, getVaultObligations } from "@/lib/queries/vaults";

export default async function VaultsPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [vaults, obligations] = await Promise.all([
    getVaults(),
    getVaultObligations(month, year),
  ]);

  return (
    <VaultsDashboard
      vaults={vaults}
      obligations={obligations}
      month={month}
      year={year}
    />
  );
}
