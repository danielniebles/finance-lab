import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayBills } from "./pay-bills";
import type { BillStatus } from "@/lib/bill-display";
import type { BillsForMonth } from "@/lib/queries/bills";

const payBillsMock = vi.fn();
vi.mock("@/lib/actions/bills", () => ({ payBills: (...args: unknown[]) => payBillsMock(...args) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const services = { id: "c-services", name: "Services", icon: null, color: null };

function bill(id: string, name: string, budget: number, over: Partial<BillStatus> = {}): BillStatus {
  return { id, name, budget, budgetType: "FIXED", category: services, paid: false, paidAmount: 0, paidOn: null, ...over };
}

const data: BillsForMonth = {
  month: 10,
  year: 2026,
  open: true,
  startISO: "2026-10-01",
  endISO: "2026-11-01",
  bills: [bill("net", "Internet", 98_000), bill("phone", "Phone", 65_000), bill("water", "Water", 60_000, { paid: true, paidAmount: 61_200, paidOn: "2026-10-04" })],
  unlinked: [{ categoryId: "c-services", categoryName: "Services", amount: 65_000 }],
};

async function openDialog() {
  const user = userEvent.setup();
  render(
    <PayBills data={data} walletOptions={[{ id: "w1", name: "Nu" }]}>
      Pay bills
    </PayBills>,
  );
  await user.click(screen.getByRole("button", { name: "Pay bills" }));
  return { user, dialog: within(screen.getByRole("dialog")) };
}

describe("PayBills", () => {
  it("keeps the space around amounts in the unlinked-spend note", async () => {
    const { dialog } = await openDialog();
    expect(dialog.getByText(/already has/).textContent).toMatch(/Services already has \$\s?65\.000 logged this month/);
  });

  it("ticks every unpaid bill, and the header box unticks and reticks them all", async () => {
    const { user, dialog } = await openDialog();
    const internet = dialog.getByRole("checkbox", { name: /^Internet/ });
    const phone = dialog.getByRole("checkbox", { name: /^Phone/ });
    expect(internet).toBeChecked();
    expect(phone).toBeChecked();
    expect(dialog.getByText("2 of 2 ticked")).toBeInTheDocument();

    const all = dialog.getByRole("checkbox", { name: "All bills" });
    await user.click(all);
    expect(internet).not.toBeChecked();
    expect(phone).not.toBeChecked();
    expect(dialog.getByText("Tick at least one bill.")).toBeInTheDocument();

    await user.click(internet);
    expect(all).toHaveAttribute("aria-checked", "mixed");
    await user.click(all);
    expect(phone).toBeChecked();
    expect(dialog.getByText("2 of 2 ticked")).toBeInTheDocument();
  });
});
