// Loan proposal resolvers. Split out of run-agent-turn.ts
// (see docs/backlog.md god-file item).

import { getLoansOverview } from "@/lib/queries/loans";
import { formatCOP } from "@/lib/format";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";

export async function resolveCreateLoan(input: Record<string, unknown>): Promise<ResolvedProposal> {
  const amount = Number(input.amount);
  const debtorName = input.debtorName as string;
  const fundingAccountName = input.fundingAccountName as string;
  const date = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const expectedBy = input.expectedBy as string | undefined;
  const notes = input.notes as string | undefined;

  const overview = await getLoansOverview();
  const accountFound = overview.accounts.find(
    (a) => a.name.toLowerCase() === fundingAccountName.toLowerCase(),
  );

  if (!accountFound) {
    return blockingProposal(
      "Create loan",
      `Savings account "${fundingAccountName}" not found. Available accounts: ${overview.accounts.map((a) => a.name).join(", ")}. Ask the user which account to use.`,
      input,
    );
  }

  const debtorFound = overview.debtors.find(
    (d) => d.name.toLowerCase() === debtorName.toLowerCase(),
  );
  const createsDebtor = !debtorFound;
  const debtorId = debtorFound?.id ?? null;

  const params: Record<string, unknown> = {
    amount,
    debtorId,
    accountId: accountFound.id,
    date,
    expectedBy: expectedBy ?? null,
    notes: notes ?? null,
    ...(createsDebtor ? { createDebtor: { name: debtorName } } : {}),
  };

  const title = `Create loan: ${formatCOP(amount)} → ${debtorName}`;
  const fields: { label: string; value: string }[] = [
    { label: "Amount", value: formatCOP(amount) },
    { label: "Debtor", value: `${debtorName}${createsDebtor ? " ⚠ new debtor will be created" : ""}` },
    { label: "From account", value: fundingAccountName },
    { label: "Expected by", value: expectedBy ?? "—" },
    { label: "Notes", value: notes ?? "—" },
  ];

  return buildResolvedProposal(params, title, fields);
}

export async function resolveRecordLoanPayment(input: Record<string, unknown>): Promise<ResolvedProposal> {
  const debtorName = input.debtorName as string;
  const amount = Number(input.amount);
  const date = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const notes = input.notes as string | undefined;

  const overview = await getLoansOverview();
  const debtor = overview.debtors.find(
    (d) => d.name.toLowerCase() === debtorName.toLowerCase(),
  );

  if (!debtor) {
    return blockingProposal(
      "Record loan payment",
      `Debtor "${debtorName}" not found. Call get_loans to see debtors.`,
      input,
    );
  }

  const activeLoans = debtor.loans
    .filter((l) => l.isActive)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (activeLoans.length === 0) {
    return blockingProposal(
      "Record loan payment",
      `No active loans found for "${debtorName}".`,
      input,
    );
  }

  // Target oldest active loan
  const targetLoan = activeLoans[0];
  const resultingBalance = Math.max(0, targetLoan.remaining - amount);

  const params: Record<string, unknown> = {
    loanId: targetLoan.id,
    debtorName,
    amount,
    date,
    notes: notes ?? null,
  };

  const title = `Record payment: ${formatCOP(amount)} from ${debtorName}`;
  const fields: { label: string; value: string }[] = [
    { label: "Debtor", value: debtorName },
    { label: "Amount", value: formatCOP(amount) },
    { label: "Loan", value: targetLoan.notes ?? `Loan of ${formatCOP(targetLoan.amount)}` },
    { label: "Current outstanding", value: formatCOP(targetLoan.remaining) },
    { label: "Resulting balance", value: formatCOP(resultingBalance) },
    { label: "Date", value: date },
    ...(notes ? [{ label: "Notes", value: notes }] : []),
  ];

  if (activeLoans.length > 1) {
    fields.push({ label: "Note", value: `${debtorName} has ${activeLoans.length} active loans — payment applied to oldest.` });
  }

  return buildResolvedProposal(params, title, fields);
}
