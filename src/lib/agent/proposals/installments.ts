// Installment proposal resolvers. Split out of run-agent-turn.ts
// (see docs/backlog.md god-file item).

import { getCardSummaries, getAllInstallments } from "@/lib/queries/installments";
import { getLoansOverview } from "@/lib/queries/loans";
import { computeInstallmentDue, isDueInMonth } from "@/lib/installment-utils";
import { formatCOP } from "@/lib/format";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";

export async function resolveCreateInstallment(
  input: Record<string, unknown>,
  currentMonth: number,
  currentYear: number,
): Promise<ResolvedProposal> {
  const description = input.description as string;
  const totalAmount = Number(input.totalAmount);
  const numInstallments = Number(input.numInstallments);
  const monthlyInterestRate = input.monthlyInterestRate != null ? Number(input.monthlyInterestRate) : 0;
  const startDate = input.startDate as string;
  const cardName = input.cardName as string | undefined;
  const fundingAccountName = input.fundingAccountName as string | undefined;

  // Resolve card
  let cardId: string | null = null;
  let createsCard = false;
  if (cardName) {
    const cards = await getCardSummaries(currentMonth, currentYear);
    const found = cards.find((c) => c.name.toLowerCase() === cardName.toLowerCase());
    if (found) {
      cardId = found.id;
    } else {
      createsCard = true;
    }
  }

  // Resolve funding account
  let fundingAccountId: string | null = null;
  if (fundingAccountName) {
    const overview = await getLoansOverview();
    const found = overview.accounts.find(
      (a) => a.name.toLowerCase() === fundingAccountName.toLowerCase(),
    );
    if (found) fundingAccountId = found.id;
  }

  // True-cost preview (German amortization)
  const monthlyCapital = Math.round(totalAmount / numInstallments);
  const firstCuotaTotal = computeInstallmentDue(totalAmount, numInstallments, 1, monthlyInterestRate);
  let totalInterest = 0;
  for (let k = 1; k <= numInstallments; k++) {
    totalInterest += computeInstallmentDue(totalAmount, numInstallments, k, monthlyInterestRate) - monthlyCapital;
  }
  const totalRepaid = totalAmount + totalInterest;

  const params: Record<string, unknown> = {
    description,
    totalAmount,
    numInstallments,
    monthlyInterestRate: monthlyInterestRate || null,
    startDate,
    cardId,
    fundingAccountId,
    ...(createsCard && cardName ? { createCard: { name: cardName } } : {}),
  };

  const title = `Create installment: ${description} — ${formatCOP(totalAmount)} × ${numInstallments}`;
  const fields: { label: string; value: string }[] = [
    { label: "Item", value: description },
    { label: "Total amount", value: formatCOP(totalAmount) },
    { label: "Monthly capital", value: formatCOP(monthlyCapital) },
    { label: "First cuota (with interest)", value: formatCOP(firstCuotaTotal) },
    { label: "Total interest", value: formatCOP(totalInterest) },
    { label: "Total repaid", value: formatCOP(totalRepaid) },
    { label: "Installments", value: String(numInstallments) },
    { label: "Card", value: cardName ? `${cardName}${createsCard ? " ⚠ new card will be created" : ""}` : "—" },
    { label: "Start date", value: startDate },
  ];

  return buildResolvedProposal(params, title, fields);
}

export async function resolveMarkInstallmentPaid(
  input: Record<string, unknown>,
  currentMonth: number,
  currentYear: number,
): Promise<ResolvedProposal> {
  const installmentName = input.installmentName as string;
  const targetMonth = input.month ? Number(input.month) : currentMonth;
  const targetYear = input.year ? Number(input.year) : currentYear;

  const installments = await getAllInstallments();
  const found = installments.find((i) =>
    i.description.toLowerCase().includes(installmentName.toLowerCase()),
  );

  if (!found) {
    return blockingProposal(
      "Mark cuota paid",
      `No installment found matching "${installmentName}". Call get_installments to see available installments.`,
      input,
    );
  }

  // Find the correct slot k for the target month
  let installmentNum: number | null = null;
  for (let k = 1; k <= found.numInstallments; k++) {
    if (isDueInMonth(found.startDate, k, targetMonth, targetYear)) {
      installmentNum = k;
      break;
    }
  }

  if (installmentNum === null) {
    return blockingProposal(
      "Mark cuota paid",
      `No cuota found for "${found.description}" in ${targetMonth}/${targetYear}.`,
      input,
    );
  }

  const amount = computeInstallmentDue(found.totalAmount, found.numInstallments, installmentNum, found.monthlyInterestRate ?? undefined);
  const paidAt = new Date().toISOString();

  const params: Record<string, unknown> = {
    installmentId: found.id,
    installmentNum,
    paidAt,
  };

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const title = `Mark cuota ${installmentNum}/${found.numInstallments} paid: ${found.description}`;
  const fields: { label: string; value: string }[] = [
    { label: "Installment", value: found.description },
    { label: "Cuota", value: `${installmentNum} / ${found.numInstallments}` },
    { label: "Month", value: `${MONTH_NAMES[targetMonth - 1]} ${targetYear}` },
    { label: "Amount due", value: formatCOP(amount) },
  ];

  return buildResolvedProposal(params, title, fields);
}
