"use client";

import { useState } from "react";
import { Plus, ArrowRightLeft, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountForm } from "./account-form";
import { DebtorForm } from "./debtor-form";
import { LoanForm } from "./loan-form";
import { PaymentForm } from "./payment-form";
import { TransferForm } from "./transfer-form";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";

type Mode =
  | "action-bar"       // top-right header — Transfer, Record Payment, New Loan
  | "add-account"      // accounts section header
  | "add-debtor"       // debtors section header → DebtorForm
  | "add-loan-button"  // per-debtor row → LoanForm pre-filled with debtorId
  | "pay-button";      // per-debtor row → PaymentForm pre-filled with debtorId

type Props = {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  mode: Mode;
  debtorId?: string;
};

type Dialog = "account" | "debtor" | "loan" | "payment" | "transfer" | null;

export function LoansClient({ accounts, debtors, mode, debtorId }: Props) {
  const [open, setOpen] = useState<Dialog>(null);

  const forms = (
    <>
      <AccountForm open={open === "account"} onClose={() => setOpen(null)} editing={null} />
      <DebtorForm open={open === "debtor"} onClose={() => setOpen(null)} editing={null} />
      <LoanForm
        open={open === "loan"}
        onClose={() => setOpen(null)}
        accounts={accounts}
        debtors={debtors}
        defaultDebtorId={debtorId}
      />
      <PaymentForm
        open={open === "payment"}
        onClose={() => setOpen(null)}
        debtors={debtors}
        defaultDebtorId={debtorId}
      />
      <TransferForm open={open === "transfer"} onClose={() => setOpen(null)} accounts={accounts} />
    </>
  );

  if (mode === "action-bar") {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen("transfer")}>
            <ArrowRightLeft className="size-3.5" />
            Transfer
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen("payment")}>
            <HandCoins className="size-3.5" />
            Record payment
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setOpen("loan")}>
            <Plus className="size-3.5" />
            New loan
          </Button>
        </div>
        {forms}
      </>
    );
  }

  if (mode === "add-account") {
    return (
      <>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen("account")}>
          <Plus className="size-3.5" />
          Add account
        </Button>
        {forms}
      </>
    );
  }

  if (mode === "add-debtor") {
    return (
      <>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen("debtor")}>
          <Plus className="size-3.5" />
          Add debtor
        </Button>
        {forms}
      </>
    );
  }

  if (mode === "add-loan-button") {
    return (
      <>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setOpen("loan")}>
          <Plus className="size-3" />
          Loan
        </Button>
        {forms}
      </>
    );
  }

  if (mode === "pay-button") {
    return (
      <>
        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setOpen("payment")}>
          <HandCoins className="size-3.5" />
          Pay
        </Button>
        {forms}
      </>
    );
  }

  return null;
}
