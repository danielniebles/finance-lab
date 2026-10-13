import { describe, expect, it } from "vitest";
import type { InstallmentRow } from "@/lib/queries/installments";
import { overdueSlots } from "./installment-utils";

function inst(over: Partial<InstallmentRow>): InstallmentRow {
  return {
    id: "i1", description: "Phone", totalAmount: 1200, numInstallments: 12, monthlyAmount: 100, monthlyInterestRate: null,
    startDate: new Date(2026, 6, 10), endDate: new Date(2027, 5, 10), notes: null, installmentsPaid: 0, remaining: 1200,
    status: "Active", payments: [], cardId: null, cardName: null, cardColor: null, debtorId: "d1", debtorName: "Ana",
    fundingAccountId: null, ...over,
  };
}

const paid = (n: number) => ({ id: `p${n}`, installmentNum: n, paidAt: new Date(2026, 6, 10) });

describe("overdueSlots", () => {
  it("lists unpaid slots from months before the viewed one, oldest first", () => {
    // Slots: Jul (1), Aug (2), Sep (3), Oct (4)…; slot 1 paid. Viewing Oct.
    const rows = overdueSlots(10, 2026, [inst({ payments: [paid(1)] })]);
    expect(rows.map((r) => r.installmentNum)).toEqual([2, 3]);
    expect(rows[0].overdueFrom).toEqual({ month: 8, year: 2026 });
    expect(rows.every((r) => r.payment === null && r.amount === 100)).toBe(true);
  });

  it("is empty when every earlier slot is paid or the plan starts later", () => {
    expect(overdueSlots(10, 2026, [inst({ payments: [paid(1), paid(2), paid(3)] })])).toEqual([]);
    expect(overdueSlots(10, 2026, [inst({ startDate: new Date(2026, 9, 10) })])).toEqual([]);
  });

  it("orders across installments by month", () => {
    const a = inst({ id: "a", startDate: new Date(2026, 8, 1) }); // Sep
    const b = inst({ id: "b", startDate: new Date(2025, 11, 1), numInstallments: 1 }); // Dec 2025
    expect(overdueSlots(10, 2026, [a, b]).map((r) => r.installment.id)).toEqual(["b", "a"]);
  });
});
