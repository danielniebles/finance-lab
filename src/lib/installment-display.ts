// Display helpers for the Installments page — pure and client-safe (type-only
// imports), so due-date labels and ordering are unit-testable.

import type { CreditCardSummary, DueThisMonth, InstallmentRow } from "@/lib/queries/installments";
import type { Tone } from "@/lib/status";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type DueLabel = { label: string; tone: Tone };

/** Whole calendar days from `today` to `date` (negative when past). */
function daysUntil(date: Date, today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Label for a card's payment due day in the viewed (month, year).
 * The month containing `today` gets relative wording ("Due today",
 * "Due in 3 days", "Was due Oct 5"), and so does a due date in the next few
 * days of a later month (the page defaults to the financial month, which
 * runs ahead of the calendar from the start day on). Otherwise the plain date.
 */
export function dueLabel(dueDay: number | null, month: number, year: number, today: Date = new Date()): DueLabel {
  if (dueDay === null) return { label: "This month", tone: "neutral" };
  const plain = `${MONTHS_SHORT[month - 1]} ${dueDay}`;
  const isCurrent = today.getMonth() + 1 === month && today.getFullYear() === year;
  const days = daysUntil(new Date(year, month - 1, dueDay), today);
  if (!isCurrent && (days < 0 || days > 3)) return { label: `Due ${plain}`, tone: "neutral" };
  if (days < 0) return { label: `Was due ${plain}`, tone: "danger" };
  if (days === 0) return { label: "Due today", tone: "danger" };
  if (days <= 3) return { label: `Due in ${days} ${days === 1 ? "day" : "days"}`, tone: "caution" };
  return { label: `Due ${plain}`, tone: "neutral" };
}

const unpaid = (d: DueThisMonth) => d.payment === null;

/** Card chip: "Paid" once every slot due on it this month is paid, else its due label. */
export function cardStatus(
  card: Pick<CreditCardSummary, "id" | "paymentDueDay" | "monthlyObligation">,
  dues: DueThisMonth[],
  month: number,
  year: number,
  today?: Date,
): DueLabel | null {
  const onCard = dues.filter((d) => d.installment.cardId === card.id);
  if (onCard.length === 0) return null;
  if (!onCard.some(unpaid)) return { label: "Paid", tone: "positive" };
  return dueLabel(card.paymentDueDay, month, year, today);
}

/** The card with unpaid slots whose due day comes first, or null. */
export function nextCardDue(
  cards: CreditCardSummary[],
  dues: DueThisMonth[],
): { card: CreditCardSummary; amount: number } | null {
  const candidates = cards
    .map((card) => ({
      card,
      amount: dues.filter((d) => unpaid(d) && d.installment.cardId === card.id).reduce((s, d) => s + d.amount, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => (a.card.paymentDueDay ?? 99) - (b.card.paymentDueDay ?? 99));
  return candidates[0] ?? null;
}

/** Unpaid first (they need action), each group in its original order. */
export function splitDues(dues: DueThisMonth[]): { toPay: DueThisMonth[]; paid: DueThisMonth[] } {
  return { toPay: dues.filter(unpaid), paid: dues.filter((d) => !unpaid(d)) };
}

/** Active first, then closest to finishing (highest share paid). */
export function sortInstallments(rows: InstallmentRow[]): InstallmentRow[] {
  const share = (r: InstallmentRow) => (r.numInstallments > 0 ? r.installmentsPaid / r.numInstallments : 1);
  return [...rows].sort(
    (a, b) =>
      Number(a.status === "Finished") - Number(b.status === "Finished") || share(b) - share(a),
  );
}
