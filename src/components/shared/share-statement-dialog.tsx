"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, FormFooter } from "@/components/ds";
import { ShareStatementCard } from "./share-statement-card";
import { canShareImage, copyImage, renderPng, shareImage } from "@/lib/share-image";
import { statementText, type ShareStatement } from "@/lib/share-statement";

const NOTE_KEY = "share-statement-note";

export function readSavedNote(): string {
  try {
    return localStorage.getItem(NOTE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveNote(note: string) {
  try {
    localStorage.setItem(NOTE_KEY, note);
  } catch {
    // Private mode or blocked storage: the note just isn't remembered.
  }
}

function fileName(s: ShareStatement) {
  const who = s.recipient.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${who || "resumen"}-${s.title.toLowerCase().replace(/\s+/g, "-")}.png`;
}

/**
 * Renders the card to a PNG shortly after it settles, so the share sheet can
 * open straight from the click (browsers drop the click if we render first).
 */
function usePngOf(node: React.RefObject<HTMLDivElement | null>, key: string, enabled: boolean) {
  const [image, setImage] = useState<{ key: string; blob: Blob } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const t = setTimeout(() => {
      if (!node.current) return;
      renderPng(node.current)
        .then((blob) => alive && setImage({ key, blob }))
        .catch(() => alive && toast.error("Couldn't render the image"));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [node, key, enabled]);
  return image?.key === key ? image.blob : null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  recipient: string;
  onRecipientChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  statement: ShareStatement;
};

/** Name + note fields, a live preview of the card, and share / copy actions. */
export function ShareStatementDialog({ open, onOpenChange, title, recipient, onRecipientChange, note, onNoteChange, statement }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const blob = usePngOf(cardRef, JSON.stringify(statement), open);
  const [phone] = useState(canShareImage);
  const name = fileName(statement);

  async function handleImage() {
    if (!blob) return;
    saveNote(note);
    try {
      if (phone) {
        if (await shareImage(blob, name, statementText(statement))) onOpenChange(false);
        return;
      }
      const how = await copyImage(blob, name);
      toast.success(how === "copied" ? "Image copied — paste it in the chat" : "Image downloaded");
    } catch {
      toast.error("Couldn't share the image");
    }
  }

  async function handleText() {
    saveNote(note);
    try {
      await navigator.clipboard.writeText(statementText(statement));
      toast.success("Text copied");
    } catch {
      toast.error("Couldn't copy the text");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <FormFooter>
          <Button type="button" variant="outline" onClick={handleText}>
            Copy text
          </Button>
          <Button type="button" disabled={!blob} onClick={handleImage}>
            {phone ? "Share image" : "Copy image"}
          </Button>
        </FormFooter>
      }
    >
      <Field label="Name" htmlFor="share-recipient" optional>
        <Input id="share-recipient" value={recipient} onChange={(e) => onRecipientChange(e.target.value)} placeholder="Who it's for" />
      </Field>
      <Field label="Note" htmlFor="share-note" optional hint="Payment details, a due date … remembered for next time.">
        <textarea
          id="share-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </Field>
      <div className="flex justify-center">
        <ShareStatementCard ref={cardRef} statement={statement} />
      </div>
    </FormDialog>
  );
}
