import { describe, expect, it } from "vitest";
import type { CreditCardSummary, DueThisMonth, InstallmentRow } from "@/lib/queries/installments";
import { cardStatus, dueLabel, nextCardDue, sortInstallments, splitDues } from "./installment-display";

const today = new Date(2026, 9, 5); // 5 Oct 2026

function due(cardId: string | null, amount: number, paid: boolean): DueThisMonth {
  return {
    installment: { id: `${cardId}-${amount}`, cardId, numInstallments: 12 } as InstallmentRow,
    installmentNum: 1,
    amount,
    payment: paid ? { id: "p", paidAt: today } : null,
  };
}

const card = (id: string, day: number | null) =>
  ({ id, name: id, paymentDueDay: day, monthlyObligation: 1, color: null, creditLimit: null, outstandingDebt: 0, installmentCount: 1 }) as CreditCardSummary;

describe("dueLabel", () => {
  it("uses relative wording in the current month", () => {
    expect(dueLabel(5, 10, 2026, today)).toEqual({ label: "Due today", tone: "danger" });
    expect(dueLabel(7, 10, 2026, today)).toEqual({ label: "Due in 2 days", tone: "caution" });
    expect(dueLabel(10, 10, 2026, today)).toEqual({ label: "Due Oct 10", tone: "neutral" });
    expect(dueLabel(2, 10, 2026, today).label).toBe("Was due Oct 2");
  });
  it("shows the plain date for other months", () => {
    expect(dueLabel(10, 11, 2026, today)).toEqual({ label: "Due Nov 10", tone: "neutral" });
  });
  it("uses relative wording for a due date in the next days of the next month", () => {
    const oct30 = new Date(2026, 9, 30);
    expect(dueLabel(1, 11, 2026, oct30)).toEqual({ label: "Due in 2 days", tone: "caution" });
    expect(dueLabel(10, 11, 2026, oct30)).toEqual({ label: "Due Nov 10", tone: "neutral" });
    const dec30 = new Date(2026, 11, 30);
    expect(dueLabel(2, 1, 2027, dec30)).toEqual({ label: "Due in 3 days", tone: "caution" });
  });
});

describe("cardStatus", () => {
  it("is Paid once every slot on the card is paid", () => {
    expect(cardStatus(card("nu", 5), [due("nu", 10, true)], 10, 2026, today)?.label).toBe("Paid");
    expect(cardStatus(card("nu", 5), [due("nu", 10, false)], 10, 2026, today)?.label).toBe("Due today");
    expect(cardStatus(card("nu", 5), [], 10, 2026, today)).toBeNull();
  });
});

describe("nextCardDue", () => {
  it("picks the earliest due day with money still owed", () => {
    const next = nextCardDue(
      [card("rappi", 10), card("nu", 5), card("fala", 1)],
      [due("rappi", 300, false), due("nu", 322, false), due("fala", 100, true)],
    );
    expect(next?.card.id).toBe("nu");
    expect(next?.amount).toBe(322);
  });
});

describe("splitDues / sortInstallments", () => {
  it("puts unpaid first", () => {
    const { toPay, paid } = splitDues([due("a", 1, true), due("b", 2, false)]);
    expect(toPay).toHaveLength(1);
    expect(paid).toHaveLength(1);
  });
  it("orders active by share paid, finished last", () => {
    const r = (id: string, paid: number, n: number, status: "Active" | "Finished" = "Active") =>
      ({ id, installmentsPaid: paid, numInstallments: n, status }) as InstallmentRow;
    expect(sortInstallments([r("a", 1, 12), r("b", 5, 6), r("c", 1, 1, "Finished")]).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});
