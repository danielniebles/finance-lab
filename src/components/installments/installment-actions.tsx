"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteInstallment } from "@/lib/actions/installments";
import { InstallmentForm } from "./installment-form";
import type { InstallmentRow } from "@/lib/queries/installments";

export function InstallmentActions(
  props:
    | { mode: "add-button" }
    | { mode: "row-actions"; installment: InstallmentRow }
) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InstallmentRow | null>(null);
  const [deletePending, startDelete] = useTransition();

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(inst: InstallmentRow) {
    setEditing(inst);
    setOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this installment and all its payment records?")) return;
    startDelete(async () => {
      await deleteInstallment(id);
    });
  }

  if (props.mode === "add-button") {
    return (
      <>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="size-3.5" />
          Add installment
        </Button>
        <InstallmentForm open={open} onClose={() => setOpen(false)} editing={null} />
      </>
    );
  }

  const { installment } = props;
  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => openEdit(installment)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          onClick={() => handleDelete(installment.id)}
          disabled={deletePending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <InstallmentForm
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </>
  );
}
