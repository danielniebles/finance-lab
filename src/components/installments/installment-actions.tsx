"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-4" />
        Add installment
      </Button>
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
