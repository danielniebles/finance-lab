"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readSavedNote, ShareStatementDialog } from "@/components/shared/share-statement-dialog";
import { installmentStatement, suggestedRecipient } from "@/lib/share-statement";
import type { DueThisMonth } from "@/lib/queries/installments";

type Props = {
  items: DueThisMonth[];
  month: number;
  year: number;
  dueDayOf: (d: DueThisMonth) => number | null;
};

/** Sends the selected slots to whoever owes them, as an image or text. */
export function ShareSelectedButton({ items, month, year, dueDayOf }: Props) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");

  function openDialog() {
    setRecipient(suggestedRecipient(items));
    setNote(readSavedNote());
    setOpen(true);
  }

  const statement = installmentStatement(items, { recipient, note, month, year, dueDayOf });

  return (
    <>
      <Button size="sm" variant="outline" onClick={openDialog} className="h-7 gap-1.5 text-xs">
        <Share2 className="size-3.5" aria-hidden />
        Share
      </Button>
      <ShareStatementDialog
        open={open}
        onOpenChange={setOpen}
        title={`Share ${items.length} ${items.length === 1 ? "installment" : "installments"}`}
        recipient={recipient}
        onRecipientChange={setRecipient}
        note={note}
        onNoteChange={setNote}
        statement={statement}
      />
    </>
  );
}
