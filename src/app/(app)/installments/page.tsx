import { InstallmentsDashboard } from "@/components/installments/installments-dashboard";
import {
  getAllInstallments,
  getMonthSummary,
  getCardSummaries,
  getInstallmentFormData,
} from "@/lib/queries/installments";

export const dynamic = "force-dynamic";

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();

  const [allInstallments, cards, formData] = await Promise.all([
    getAllInstallments(),
    getCardSummaries(month, year),
    getInstallmentFormData(),
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
    />
  );
}
