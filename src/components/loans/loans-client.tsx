"use client";

import { useState } from "react";
import { Plus, ArrowRightLeft, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountForm } from "./account-form";
import { LoanForm } from "./loan-form";
import { PaymentForm } from "./payment-form";
import { TransferForm } from "./transfer-form";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";

type Mode =
  | "action-bar"     // top-right header bar
  | "add-account"    // section header button
  | "add-debtor"     // section header button
  | "add-loan-button"// per-debtor row
  | "pay-button";    // per-debtor row

type Props = {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  mode: Mode;
  debtorId?: string;
};

type Dialog = "account" | "loan" | "payment" | "transfer" | "debtor" | null;

export function LoansClient({ accounts, debtors, mode, debtorId }: Props) {
  const [open, setOpen] = useState<Dialog>(null);

  const forms = (
    <>
      <AccountForm
        open={open === "account"}
        onClose={() => setOpen(null)}
        editing={null}
      />
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
      <TransferForm
        open={open === "transfer"}
        onClose={() => setOpen(null)}
        accounts={accounts}
      />
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
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen("loan")}>
          <Plus className="size-3.5" />
          Add debtor & loan
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
