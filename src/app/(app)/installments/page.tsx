import { InstallmentsDashboard } from "@/components/installments/installments-dashboard";

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

  return <InstallmentsDashboard month={month} year={year} />;
}
