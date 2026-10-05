// Display rules for the Savings & Loans page. Pure and client-safe so they
// can be unit-tested without a DB.

import type { DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import type { Tone } from "@/lib/status";

const DAY_MS = 1000 * 60 * 60 * 24;
/** No payment for this long on a loan this old → flagged "stale". */
export const STALE_DAYS = 90;

export type LoanMeta = {
  /** Share repaid, 0–100. */
  pct: number;
  ageDays: number;
  ageLabel: string;
  isOverdue: boolean;
  isStale: boolean;
};

export function ageLabel(days: number): string {
  return days >= 30 ? `${Math.floor(days / 30)}mo` : `${days}d`;
}

export function computeLoanMeta(loan: LoanWithRemaining, now: Date = new Date()): LoanMeta {
  const t = now.getTime();
  const pct = loan.amount > 0 ? Math.min(100, (loan.paid / loan.amount) * 100) : 0;
  const ageDays = Math.floor((t - new Date(loan.date).getTime()) / DAY_MS);
  const isOverdue = loan.isActive && !!loan.expectedBy && new Date(loan.expectedBy).getTime() < t;
  const lastPayment = loan.payments.length > 0 ? Math.max(...loan.payments.map((p) => new Date(p.date).getTime())) : null;
  const daysSincePayment = lastPayment !== null ? Math.floor((t - lastPayment) / DAY_MS) : ageDays;
  const isStale = loan.isActive && ageDays > STALE_DAYS && daysSincePayment > STALE_DAYS;
  return { pct, ageDays, ageLabel: ageLabel(ageDays), isOverdue, isStale };
}

/**
 * Status chip for a loan row. Active loans are the normal case, so they get
 * no chip — only the exceptions (overdue, settled) are called out.
 */
export function loanChip(loan: LoanWithRemaining, meta: LoanMeta): { tone: Tone; label: string } | null {
  if (!loan.isActive) return { tone: "positive", label: "Settled" };
  if (meta.isOverdue) return { tone: "danger", label: "Overdue" };
  return null;
}

/** "Ana María" → "AM"; one word → its first letter. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "2 active loans · oldest 7mo", or "All settled". */
export function debtorSubtitle(debtor: DebtorWithLoans, now: Date = new Date()): string {
  const active = debtor.loans.filter((l) => l.isActive);
  if (active.length === 0) return "All settled";
  const oldest = Math.max(...active.map((l) => computeLoanMeta(l, now).ageDays));
  const count = `${active.length} active loan${active.length === 1 ? "" : "s"}`;
  return active.length > 1 ? `${count} · oldest ${ageLabel(oldest)}` : `${count} · ${ageLabel(oldest)}`;
}

/** Debtors with money owed first (biggest first), settled ones after. */
export function sortDebtors(debtors: DebtorWithLoans[]): DebtorWithLoans[] {
  return [...debtors].sort((a, b) => b.totalOwed - a.totalOwed || a.name.localeCompare(b.name));
}

/** Loans in a debtor card: active first (oldest first), then settled (newest first). */
export function sortLoans(loans: LoanWithRemaining[]): LoanWithRemaining[] {
  const time = (l: LoanWithRemaining) => new Date(l.date).getTime();
  return [...loans].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.isActive ? time(a) - time(b) : time(b) - time(a);
  });
}

export type CompositionPart = { key: string; label: string; value: number; pct: number; fill: string };

/**
 * Where net worth sits: liquid, lent out, earmarked in vaults. Chart series
 * colours, never status colours (DESIGN.md). Negative parts are dropped from
 * the bar so it can't render a negative width.
 */
export function netWorthComposition(data: { available: number; inLoans: number; inVaults: number }): CompositionPart[] {
  const parts = [
    { key: "available", label: "Available", value: data.available, fill: "bg-chart-1" },
    { key: "loans", label: "Lent out", value: data.inLoans, fill: "bg-chart-2" },
    { key: "vaults", label: "In vaults", value: data.inVaults, fill: "bg-chart-5" },
  ];
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return parts.map((p) => ({ ...p, pct: total > 0 ? (Math.max(0, p.value) / total) * 100 : 0 }));
}
