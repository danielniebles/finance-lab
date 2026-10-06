import { describe, expect, it } from "vitest";
import { cardFormState, parseDay } from "./credit-card-manager";

const card = {
  id: "k1", name: "Visa", color: "#3B82F6", creditLimit: 5_000_000, billingClosingDay: 28, paymentDueDay: 10,
  outstandingDebt: 0, monthlyObligation: 0, installmentCount: 2,
};

describe("credit card form", () => {
  it("loads every stored field, so saving an edit doesn't wipe the limit or closing day", () => {
    expect(cardFormState(card)).toEqual({ name: "Visa", creditLimit: "5000000", billingClosingDay: "28", paymentDueDay: "10", color: "#3B82F6" });
  });
  it("leaves missing values empty", () => {
    expect(cardFormState({ ...card, creditLimit: null, billingClosingDay: null, paymentDueDay: null, color: null })).toMatchObject({
      creditLimit: "", billingClosingDay: "", paymentDueDay: "",
    });
  });
  it("accepts only days 1–31", () => {
    expect(parseDay("10")).toBe(10);
    expect(parseDay("31")).toBe(31);
    expect(parseDay("0")).toBeUndefined();
    expect(parseDay("32")).toBeUndefined();
    expect(parseDay("")).toBeUndefined();
  });
});
