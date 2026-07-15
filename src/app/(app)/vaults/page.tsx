export const dynamic = "force-dynamic";

import { VaultsDashboard } from "@/components/vaults/vaults-dashboard";
import { getVaults, getVaultObligations } from "@/lib/queries/vaults";
import { getRecurringExpenses } from "@/lib/queries/recurring";
import { getWalletBalances } from "@/lib/queries/wallets";
import { getCategories } from "@/lib/queries/expenses";
import { financialMonthYear } from "@/lib/financial-period-utils";

export default async function VaultsPage() {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { month, year } = financialMonthYear(new Date(), startDay);

  const [vaults, obligations, recurringData, walletBalances, categories] = await Promise.all([
    getVaults(),
    getVaultObligations(month, year),
    getRecurringExpenses(month, year),
    getWalletBalances(),
    getCategories(),
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
      walletAccounts={walletBalances.accounts}
      categories={categories}
    />
  );
}
