import { db } from "@/lib/db";

export type AccountWithBalance = {
  id: string;
  name: string;
  accountType: "BANK" | "DIGITAL" | "PENSION";
  color: string | null;
  includeInAvailable: boolean;
  balance: number;
  entries: { id: string; type: "INITIAL" | "ADJUSTMENT"; amount: number; date: Date; notes: string | null }[];
};

export type LoanWithRemaining = {
  id: string;
  debtorId: string;
  accountId: string;
  accountName: string;
  accountColor: string | null;
  amount: number;
  date: Date;
  expectedBy: Date | null;
  notes: string | null;
  createdAt: Date;
  paid: number;
  remaining: number;
  isActive: boolean;
  payments: { id: string; amount: number; date: Date; notes: string | null }[];
};

export type DebtorWithLoans = {
  id: string;
  name: string;
  notes: string | null;
  loans: LoanWithRemaining[];
  totalOwed: number;
  activeLoansCount: number;
};

export type LoansOverview = {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  available: number;
  inLoans: number;
  totalSavings: number;
  liquidityRatio: number | null;
};

export async function getLoansOverview(): Promise<LoansOverview> {
  const [accounts, debtors] = await Promise.all([
    db.savingsAccount.findMany({
      include: {
        entries: { orderBy: { date: "asc" } },
        loansGiven: {
          include: { payments: { orderBy: { date: "asc" } } },
          orderBy: { date: "asc" },
        },
        transfersFrom: true,
        transfersTo: true,
      },
      orderBy: { name: "asc" },
    }),
    db.debtor.findMany({
      include: {
        loans: {
          include: {
            payments: { orderBy: { date: "asc" } },
            account: { select: { name: true, color: true } },
          },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Derive account balances from full transaction log
  const accountsWithBalance: AccountWithBalance[] = accounts.map((acc) => {
    const entriesTotal = acc.entries.reduce((s, e) => s + e.amount, 0);
    const transfersIn = acc.transfersTo.reduce((s, t) => s + t.amount, 0);
    const transfersOut = acc.transfersFrom.reduce((s, t) => s + t.amount, 0);
    const loansOut = acc.loansGiven.reduce((s, l) => s + l.amount, 0);
    const paymentsIn = acc.loansGiven
      .flatMap((l) => l.payments)
      .reduce((s, p) => s + p.amount, 0);
    const balance = entriesTotal + transfersIn - transfersOut - loansOut + paymentsIn;
    return {
      id: acc.id,
      name: acc.name,
      accountType: acc.accountType,
      color: acc.color,
      includeInAvailable: acc.includeInAvailable,
      balance,
      entries: acc.entries,
    };
  });

  // Derive loan remaining balances and debtor totals
  const debtorsWithLoans: DebtorWithLoans[] = debtors.map((d) => {
    const loans: LoanWithRemaining[] = d.loans.map((l) => {
      const paid = l.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, l.amount - paid);
      return {
        id: l.id,
        debtorId: l.debtorId,
        accountId: l.accountId,
        accountName: l.account.name,
        accountColor: l.account.color,
        amount: l.amount,
        date: l.date,
        expectedBy: l.expectedBy,
        notes: l.notes,
        createdAt: l.createdAt,
        paid,
        remaining,
        isActive: remaining > 0,
        payments: l.payments,
      };
    });
    const totalOwed = loans.reduce((s, l) => s + l.remaining, 0);
    const activeLoansCount = loans.filter((l) => l.isActive).length;
    return { id: d.id, name: d.name, notes: d.notes, loans, totalOwed, activeLoansCount };
  });

  // KPIs
  const available = accountsWithBalance
    .filter((a) => a.includeInAvailable)
    .reduce((s, a) => s + a.balance, 0);

  const inLoans = debtorsWithLoans.reduce((s, d) => s + d.totalOwed, 0);
  const totalSavings = available + inLoans;
  const liquidityRatio = totalSavings > 0 ? (available / totalSavings) * 100 : null;

  return { accounts: accountsWithBalance, debtors: debtorsWithLoans, available, inLoans, totalSavings, liquidityRatio };
}
