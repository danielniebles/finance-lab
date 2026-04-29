export const dynamic = "force-dynamic";

import { getLoansOverview } from "@/lib/queries/loans";
import { LoansDashboard } from "@/components/loans/loans-dashboard";

export default async function LoansPage() {
  const data = await getLoansOverview();
  return <LoansDashboard data={data} />;
}
