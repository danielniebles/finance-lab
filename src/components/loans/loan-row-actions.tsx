"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoanForm } from "./loan-form";
import { deleteLoan } from "@/lib/actions/loans";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";

export function LoanRowActions({
  loan,
  accounts,
  debtors,
}: {
  loan: LoanWithRemaining;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this loan? All payment records will also be removed.")) return;
    startDelete(async () => { await deleteLoan(loan.id); });
  }

  return (
    <>
      <div className="flex items-center gap-0.5 justify-end">
        <Button variant="ghost" size="icon" className="size-6" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={deletePending}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
      <LoanForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        accounts={accounts}
        debtors={debtors}
        editing={loan}
      />
    </>
  );
}
