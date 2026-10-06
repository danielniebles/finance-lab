"use client";

import { useState } from "react";
import { HeaderAction } from "@/components/ds";
import { InstallmentForm } from "./installment-form";

type FormData = {
  formCards?: { id: string; name: string; color: string | null }[];
  formDebtors?: { id: string; name: string }[];
  formAccounts?: { id: string; name: string }[];
};

export function InstallmentActions({
  formCards = [],
  formDebtors = [],
  formAccounts = [],
}: FormData) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <HeaderAction label="Add installment" shortLabel="Add" onClick={() => setOpen(true)} />
      <InstallmentForm
        open={open}
        onClose={() => setOpen(false)}
        editing={null}
        cards={formCards}
        debtors={formDebtors}
        accounts={formAccounts}
      />
    </>
  );
}
