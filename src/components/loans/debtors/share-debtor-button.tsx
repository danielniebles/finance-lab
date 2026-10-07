"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readSavedNote, ShareStatementDialog } from "@/components/shared/share-statement-dialog";
import { debtorStatement } from "@/lib/share-statement";
import type { DebtorWithLoans } from "@/lib/queries/loans";

/** Sends a debtor their current statement, as an image or text. */
export function ShareDebtorButton({ debtor }: { debtor: DebtorWithLoans }) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState(debtor.name);
  const [note, setNote] = useState("");

  function openDialog() {
    setRecipient(debtor.name);
    setNote(readSavedNote());
    setOpen(true);
  }

  const statement = debtorStatement(debtor, { recipient, note });

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={openDialog}>
        <Share2 className="size-3.5" />
        Share
      </Button>
      <ShareStatementDialog
        open={open}
        onOpenChange={setOpen}
        title={`Share ${debtor.name}'s statement`}
        recipient={recipient}
        onRecipientChange={setRecipient}
        note={note}
        onNoteChange={setNote}
        statement={statement}
      />
    </>
  );
}
