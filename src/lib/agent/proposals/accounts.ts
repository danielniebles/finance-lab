// Savings-account proposal resolvers (direct adjustments + transfers between
// accounts). Mirrors the shape of proposals/loans.ts — account-name → id
// resolution, blocking (never auto-create) if a name doesn't match.

import { getLoansOverview, type AccountWithBalance } from "@/lib/queries/loans";
import { formatCOP } from "@/lib/format";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";

function findAccountByName(
  accounts: AccountWithBalance[],
  name: string,
): AccountWithBalance | undefined {
  return accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
}

function accountNotFoundMessage(accounts: AccountWithBalance[], name: string): string {
  return `Savings account "${name}" not found. Available accounts: ${accounts
    .map((a) => a.name)
    .join(", ")}. Ask the user which account to use.`;
}

export async function resolveAccountAdjustment(
  input: Record<string, unknown>,
): Promise<ResolvedProposal> {
  const accountName = input.accountName as string;
  const amount = Number(input.amount);
  const date = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const notes = input.notes as string | undefined;

  const overview = await getLoansOverview();
  const account = findAccountByName(overview.accounts, accountName);

  if (!account) {
    return blockingProposal(
      "Account adjustment",
      accountNotFoundMessage(overview.accounts, accountName),
      input,
    );
  }

  const params: Record<string, unknown> = {
    accountId: account.id,
    amount,
    date,
    notes: notes ?? null,
  };

  const direction = amount < 0 ? "Debit" : "Credit";
  const title = `${direction} ${formatCOP(Math.abs(amount))} ${amount < 0 ? "from" : "to"} ${account.name}`;
  const fields: { label: string; value: string }[] = [
    { label: "Account", value: account.name },
    { label: "Amount", value: formatCOP(amount) },
    { label: "Date", value: date },
    { label: "Notes", value: notes ?? "—" },
  ];

  return buildResolvedProposal(params, title, fields);
}

export async function resolveTransfer(
  input: Record<string, unknown>,
): Promise<ResolvedProposal> {
  const fromAccountName = input.fromAccountName as string;
  const toAccountName = input.toAccountName as string;
  const amount = Number(input.amount);
  const date = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const notes = input.notes as string | undefined;

  const overview = await getLoansOverview();
  const fromAccount = findAccountByName(overview.accounts, fromAccountName);
  if (!fromAccount) {
    return blockingProposal(
      "Transfer",
      accountNotFoundMessage(overview.accounts, fromAccountName),
      input,
    );
  }

  const toAccount = findAccountByName(overview.accounts, toAccountName);
  if (!toAccount) {
    return blockingProposal(
      "Transfer",
      accountNotFoundMessage(overview.accounts, toAccountName),
      input,
    );
  }

  const params: Record<string, unknown> = {
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    amount,
    date,
    notes: notes ?? null,
  };

  const title = `Transfer ${formatCOP(amount)}: ${fromAccount.name} → ${toAccount.name}`;
  const fields: { label: string; value: string }[] = [
    { label: "From account", value: fromAccount.name },
    { label: "To account", value: toAccount.name },
    { label: "Amount", value: formatCOP(amount) },
    { label: "Date", value: date },
    { label: "Notes", value: notes ?? "—" },
  ];

  return buildResolvedProposal(params, title, fields);
}
