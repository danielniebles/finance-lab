import { describe, expect, it } from "vitest";
import { debtorStatement, dueText, installmentStatement, statementText, suggestedRecipient } from "./share-statement";
import type { DueThisMonth } from "@/lib/queries/installments";
import type { LoanWithRemaining } from "@/lib/queries/loans";

function due(description: string, num: number, of: number, amount: number, debtorName: string | null = null): DueThisMonth {
  return {
    installment: { description, numInstallments: of, debtorName, cardId: "c1" } as DueThisMonth["installment"],
    installmentNum: num,
    amount,
    payment: null,
  };
}

const today = new Date(2026, 9, 7);

describe("dueText", () => {
  it("is empty without a due day", () => {
    expect(dueText(null, 10, 2026, today)).toBe("");
  });
  it("says vence for today and later, venció for past days", () => {
    expect(dueText(7, 10, 2026, today)).toBe("vence 7 oct");
    expect(dueText(10, 10, 2026, today)).toBe("vence 10 oct");
    expect(dueText(5, 10, 2026, today)).toBe("venció 5 oct");
  });
});

describe("suggestedRecipient", () => {
  it("returns the shared debtor name", () => {
    expect(suggestedRecipient([due("a", 1, 2, 1, "Maria"), due("b", 1, 2, 1, "Maria")])).toBe("Maria");
  });
  it("is empty when debtors differ or are missing", () => {
    expect(suggestedRecipient([due("a", 1, 2, 1, "Maria"), due("b", 1, 2, 1, "Javier")])).toBe("");
    expect(suggestedRecipient([due("a", 1, 2, 1, "Maria"), due("b", 1, 2, 1)])).toBe("");
    expect(suggestedRecipient([due("a", 1, 2, 1)])).toBe("");
  });
});

describe("installmentStatement", () => {
  const items = [due("Arriendo maria", 6, 12, 322245), due("Ropa", 1, 1, 126900)];
  const s = installmentStatement(items, {
    recipient: " Maria ",
    note: "Nequi 300 000 0000",
    month: 10,
    year: 2026,
    dueDayOf: (d) => (d.installment.description === "Ropa" ? null : 5),
    today,
  });

  it("builds lines, total and labels", () => {
    expect(s.recipient).toBe("Maria");
    expect(s.title).toBe("Cuotas octubre 2026");
    expect(s.total).toBe(449145);
    expect(s.lines).toEqual([
      { label: "Arriendo maria", detail: "Cuota 6 de 12 · venció 5 oct", amount: 322245 },
      { label: "Ropa", detail: "Cuota 1 de 1", amount: 126900 },
    ]);
    expect(s.issuedOn).toBe("7 oct 2026");
  });

  it("renders as a chat message", () => {
    const text = statementText(s);
    expect(text.startsWith("Hola Maria, resumen de cuotas octubre 2026:")).toBe(true);
    expect(text).toContain("• Ropa (cuota 1 de 1): ");
    expect(text).toContain("*Total: ");
    expect(text.endsWith("Nequi 300 000 0000")).toBe(true);
  });
});

/** Noon UTC: the same calendar day whatever timezone the tests run in. */
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12));

function loan(over: Partial<LoanWithRemaining>): LoanWithRemaining {
  return {
    id: "l", debtorId: "d", accountId: "a", accountName: "A", accountColor: null,
    amount: 100, date: day(2026, 6, 1), expectedBy: null, notes: null, createdAt: day(2026, 6, 1),
    paid: 0, remaining: 100, isActive: true, payments: [], linkedTransaction: null, installmentSlots: 0,
    ...over,
  };
}

describe("debtorStatement", () => {
  const loans = [
    loan({ notes: "Cuota 4/12 — Arriendo", amount: 300, remaining: 300, date: day(2026, 8, 10) }),
    loan({
      amount: 500, paid: 200, remaining: 300, date: day(2026, 7, 12), expectedBy: day(2026, 9, 30),
      payments: [
        { id: "p1", amount: 50, date: day(2026, 7, 20), notes: null },
        { id: "p2", amount: 100, date: day(2026, 9, 2), notes: null },
        { id: "p3", amount: 30, date: day(2026, 8, 1), notes: null },
        { id: "p4", amount: 20, date: day(2026, 8, 15), notes: null },
      ],
    }),
    loan({ notes: "Viejo", isActive: false, remaining: 0, paid: 100, date: day(2026, 0, 1), expectedBy: day(2026, 1, 1) }),
  ];
  const s = debtorStatement({ loans, totalOwed: 600 }, { recipient: "María", note: "", today });

  it("lists active loans oldest first with what's left", () => {
    expect(s.lines.map((l) => l.label)).toEqual(["Préstamo", "Cuota 4/12 — Arriendo"]);
    expect(s.lines[0].amount).toBe(300);
    expect(s.lines[0].detail).toMatch(/^12 ago · abonado .* de .* · acordado 30 oct$/);
    expect(s.lines[1].detail).toBe("10 sep");
    expect(s.total).toBe(600);
    expect(s.totalLabel).toBe("Saldo pendiente");
  });

  it("adds the year to dates from another year", () => {
    const old = debtorStatement({ loans: [loan({ date: day(2025, 2, 19) })], totalOwed: 100 }, { recipient: "", note: "", today });
    expect(old.lines[0].detail).toBe("19 mar 2025");
  });

  it("reads stored dates as UTC calendar days", () => {
    const utc = debtorStatement({ loans: [loan({ date: new Date(Date.UTC(2026, 2, 20)) })], totalOwed: 100 }, { recipient: "", note: "", today });
    expect(utc.lines[0].detail).toBe("20 mar");
  });

  it("flags a passed agreed date", () => {
    const late = debtorStatement({ loans: [loan({ expectedBy: day(2026, 9, 1) })], totalOwed: 100 }, { recipient: "", note: "", today });
    expect(late.lines[0].detail).toBe("1 jul · venció 1 oct");
  });

  it("keeps the three most recent payments, newest first", () => {
    expect(s.extra?.heading).toBe("Últimos abonos");
    expect(s.extra?.lines.map((l) => l.label)).toEqual(["2 oct", "15 sep", "1 sep"]);
  });

  it("omits the payments section when there are none", () => {
    expect(debtorStatement({ loans: [loan({})], totalOwed: 100 }, { recipient: "", note: "", today }).extra).toBeUndefined();
  });

  it("renders as a chat message", () => {
    const text = statementText(s);
    expect(text.startsWith("Hola María, estado de cuenta al 7 oct 2026:")).toBe(true);
    expect(text).toContain("Préstamos activos:");
    expect(text).toContain("*Saldo pendiente: ");
    expect(text).toContain("Últimos abonos:\n• 2 oct (préstamo): ");
  });
});
