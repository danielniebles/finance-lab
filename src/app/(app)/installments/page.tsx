import { InstallmentsDashboard } from "@/components/installments/installments-dashboard";
import {
  getAllInstallments,
  getMonthSummary,
  getCardSummaries,
  getInstallmentFormData,
} from "@/lib/queries/installments";
import { listWalletOptions } from "@/lib/queries/wallets";
import { getCategories } from "@/lib/queries/expenses";
import { financialMonthYear } from "@/lib/financial-period-utils";

export const dynamic = "force-dynamic";

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  // Default to the current FINANCIAL month, like Home and the Advisor: from the
  // start day on, salary already covers next month's installments.
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const current = financialMonthYear(new Date(), startDay);
  const month = params.month ? parseInt(params.month, 10) : current.month;
  const year = params.year ? parseInt(params.year, 10) : current.year;

  const [allInstallments, cards, formData, walletOptions, categories] = await Promise.all([
    getAllInstallments(),
    getCardSummaries(month, year),
    getInstallmentFormData(),
    listWalletOptions(),
    getCategories(),
  ]);
  const summary = await getMonthSummary(month, year, allInstallments);

  return (
    <InstallmentsDashboard
      month={month}
      year={year}
      allInstallments={allInstallments}
      summary={summary}
      cards={cards}
      formCards={formData.cards}
      formDebtors={formData.debtors}
      formAccounts={formData.accounts}
      walletOptions={walletOptions}
      categories={categories}
    />
  );
}
