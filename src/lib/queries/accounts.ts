import { db } from "@/lib/db";

export type AccountOption = {
  id: string;
  name: string;
  balance: number;
};

export async function getSavingsAccounts(): Promise<AccountOption[]> {
  const accounts = await db.savingsAccount.findMany({
    orderBy: { name: "asc" },
    include: {
      entries: true,
      transfersFrom: true,
      transfersTo: true,
      loansGiven: { include: { payments: true } },
      vaultEntriesFunded: true,
    },
  });

  return accounts.map((acc) => {
    const entriesTotal = acc.entries.reduce((s, e) => s + e.amount, 0);
    const transfersIn = acc.transfersTo.reduce((s, t) => s + t.amount, 0);
    const transfersOut = acc.transfersFrom.reduce((s, t) => s + t.amount, 0);
    const totalLent = acc.loansGiven.reduce((s, l) => s + l.amount, 0);
    const paymentsIn = acc.loansGiven
      .flatMap((l) => l.payments)
      .reduce((s, p) => s + p.amount, 0);
    const vaultFundedNet = acc.vaultEntriesFunded.reduce((s, e) => s + e.amount, 0);
    const balance =
      entriesTotal + transfersIn - transfersOut - totalLent + paymentsIn - vaultFundedNet;
    return { id: acc.id, name: acc.name, balance };
  });
}
