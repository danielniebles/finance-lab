import { describe, expect, it } from "vitest";
import {
  billDefaultForType,
  billDifference,
  billStatuses,
  isDateInPeriod,
  paidChipLabel,
  payBillsMissingHint,
  unpaidBills,
  type BudgetItemForBills,
  type PeriodExpense,
} from "./bill-display";

const SERVICES = "c-services";
const OCT_1 = "2026-10-01";
const NOV_1 = "2026-11-01";
const TODAY = "2026-10-07";
const services = { id: SERVICES, name: "Services", icon: null, color: null };
const health = { id: "c-health", name: "Health", icon: null, color: null };
const home = { id: "c-home", name: "Home", icon: null, color: null };

function item(id: string, name: string, amount: number, category: BudgetItemForBills["category"], over: Partial<BudgetItemForBills> = {}): BudgetItemForBills {
  return { id, name, amount, budgetType: "FIXED", isBill: true, category, ...over };
}

function expense(amount: number, appCategoryId: string | null, budgetItemId: string | null = null, day = 5): PeriodExpense {
  return { amount, date: new Date(2026, 9, day, 12), appCategoryId, budgetItemId };
}

const items = [
  item("phone", "Phone", 65_000, services),
  item("internet", "Internet", 98_000, services),
  item("elec", "Electricity", 140_000, services, { budgetType: "VARIABLE" }),
  item("gym", "Gym", 120_000, health),
  item("rent", "Rent", 1_800_000, home),
  item("groceries", "Groceries", 900_000, home, { budgetType: "VARIABLE", isBill: false }),
];

describe("billStatuses", () => {
  it("lists only bills, unpaid first and biggest first", () => {
    const { bills } = billStatuses(items, []);
    expect(bills.map((b) => b.id)).toEqual(["rent", "elec", "gym", "internet", "phone"]);
    expect(bills.every((b) => !b.paid)).toBe(true);
  });

  it("marks a bill paid by a linked expense in its category", () => {
    const { bills } = billStatuses(items, [expense(-152_300, SERVICES, "elec", 3)]);
    const elec = bills.find((b) => b.id === "elec");
    expect(elec).toMatchObject({ paid: true, paidAmount: 152_300, paidOn: "2026-10-03" });
    expect(bills.find((b) => b.id === "phone")?.paid).toBe(false);
  });

  it("ignores a link whose expense was moved to another category", () => {
    const { bills } = billStatuses(items, [expense(-65_000, "c-health", "phone")]);
    expect(bills.find((b) => b.id === "phone")?.paid).toBe(false);
    // …and that spend counts as unlinked spend in its new category, paying the sole-item Gym.
    expect(bills.find((b) => b.id === "gym")?.paid).toBe(true);
  });

  it("falls back to unlinked spend when the bill is its category's only item", () => {
    const { bills } = billStatuses(items, [expense(-120_000, "c-health", null, 2), expense(-5_000, "c-health", null, 9)]);
    expect(bills.find((b) => b.id === "gym")).toMatchObject({ paid: true, paidAmount: 125_000, paidOn: "2026-10-09" });
  });

  it("doesn't attribute unlinked spend in a category with several items", () => {
    const { bills, unlinked } = billStatuses(items, [expense(-65_000, SERVICES)]);
    expect(bills.filter((b) => b.category.id === SERVICES).every((b) => !b.paid)).toBe(true);
    expect(unlinked).toEqual([{ categoryId: SERVICES, categoryName: "Services", amount: 65_000 }]);
  });

  it("doesn't report unlinked spend where non-bill items explain it", () => {
    const { bills, unlinked } = billStatuses(items, [expense(-300_000, "c-home")]);
    expect(bills.find((b) => b.id === "rent")?.paid).toBe(false);
    expect(unlinked).toEqual([]);
  });

  it("skips income, transfers' positive legs and uncategorized rows", () => {
    const { bills } = billStatuses(items, [expense(500_000, "c-health"), expense(-10_000, null, "gym")]);
    expect(bills.find((b) => b.id === "gym")?.paid).toBe(false);
  });
});

describe("unpaidBills", () => {
  it("returns names and budget amounts of the unpaid ones", () => {
    const { bills } = billStatuses(items, [expense(-1_800_000, "c-home", "rent")]);
    expect(unpaidBills(bills)).toEqual([
      { name: "Electricity", amount: 140_000 },
      { name: "Gym", amount: 120_000 },
      { name: "Internet", amount: 98_000 },
      { name: "Phone", amount: 65_000 },
    ]);
  });
});

describe("form helpers", () => {
  it("defaults fixed items to bills", () => {
    expect(billDefaultForType("FIXED")).toBe(true);
    expect(billDefaultForType("VARIABLE")).toBe(false);
  });

  it("computes the difference from the budget", () => {
    expect(billDifference("152300", 140_000)).toBe(12_300);
    expect(billDifference("98000", 98_000)).toBe(0);
    expect(billDifference("", 98_000)).toBeNull();
  });

  it("checks a date against a half-open period", () => {
    expect(isDateInPeriod(OCT_1, OCT_1, NOV_1)).toBe(true);
    expect(isDateInPeriod("2026-10-31", OCT_1, NOV_1)).toBe(true);
    expect(isDateInPeriod(NOV_1, OCT_1, NOV_1)).toBe(false);
    expect(isDateInPeriod("2026-09-30", OCT_1, NOV_1)).toBe(false);
  });

  it("labels when a bill was paid", () => {
    const now = new Date(2026, 9, 7, 9);
    expect(paidChipLabel(TODAY, now)).toBe("Paid today");
    expect(paidChipLabel("2026-10-06", now)).toBe("Paid yesterday");
    expect(paidChipLabel(OCT_1, now)).toBe("Paid Oct 1");
    expect(paidChipLabel(null, now)).toBe("Paid");
  });

  it("explains what's missing", () => {
    const rows = [
      { name: "Gym", checked: true, amount: "120000" },
      { name: "Phone", checked: false, amount: "" },
    ];
    expect(payBillsMissingHint(rows, "w1", TODAY)).toBe("");
    expect(payBillsMissingHint(rows, null, TODAY)).toBe("Pick a wallet.");
    expect(payBillsMissingHint([{ ...rows[0], amount: "" }], "w1", TODAY)).toBe("Add an amount for Gym.");
    expect(payBillsMissingHint([{ ...rows[0], checked: false }], "w1", TODAY)).toBe("Tick at least one bill.");
  });
});
