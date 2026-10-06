"use client";

import { useState } from "react";
import { Plus, ArrowRightLeft, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderAction } from "@/components/ds";
import { AccountForm } from "./account-form";
import { DebtorForm } from "./debtor-form";
import { LoanForm } from "./loan-form";
import { PaymentForm } from "./payment-form";
import { TransferForm } from "./transfer-form";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";

type Mode =
  | "transfer"         // page header control (outline) → TransferForm
  | "new-loan"         // page header primary action → LoanForm
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
        accounts={accounts}
        debtors={debtors}
        defaultDebtorId={debtorId}
      />
      <TransferForm open={open === "transfer"} onClose={() => setOpen(null)} accounts={accounts} />
    </>
  );

  if (mode === "transfer") {
    return (
      <>
        <Button variant="outline" size="lg" className="gap-1.5 max-sm:flex-1" onClick={() => setOpen("transfer")}>
          <ArrowRightLeft className="size-4" />
          Transfer
        </Button>
        {forms}
      </>
    );
  }

  if (mode === "new-loan") {
    return (
      <>
        <HeaderAction label="New loan" shortLabel="Loan" onClick={() => setOpen("loan")} />
        {forms}
      </>
    );
  }

  if (mode === "add-account") {
    return (
      <>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen("account")}>
          <Plus className="size-4" />
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
          <Plus className="size-4" />
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
          <Plus className="size-3.5" />
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
          <HandCoins className="size-4" />
          Pay
        </Button>
        {forms}
      </>
    );
  }

  return null;
}
