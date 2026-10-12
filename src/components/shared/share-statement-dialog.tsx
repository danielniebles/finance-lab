"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, FormFooter } from "@/components/ds";
import { ShareStatementCard } from "./share-statement-card";
import { canShareImage, copyImage, renderPng, shareImage } from "@/lib/share-image";
import { statementText, type ShareStatement } from "@/lib/share-statement";
import { cn } from "@/lib/utils";

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
 * A card that isn't on screen (the phone's pick step) is skipped; `key`
 * changes when it shows, so it renders then.
 */
function usePngOf(node: React.RefObject<HTMLDivElement | null>, key: string, enabled: boolean) {
  const [image, setImage] = useState<{ key: string; blob: Blob } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const t = setTimeout(() => {
      if (!node.current || node.current.offsetParent === null) return;
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

type Step = "pick" | "preview";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  recipient: string;
  onRecipientChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  statement: ShareStatement;
  /**
   * What to include (e.g. a loan picker). With it the dialog goes wide, the
   * preview sits beside the controls (md+), and phones get a pick step then
   * a preview step.
   */
  children?: React.ReactNode;
  /** Footer readout for the current pick ("3 of 5 · total …"). */
  summary?: React.ReactNode;
  /** False when nothing is picked: sharing is off and the preview says why. */
  canShare?: boolean;
};

function PreviewTitle({ onBack }: { onBack: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon" className="-ml-2 size-11" onClick={onBack} aria-label="Back to the selection">
        <ChevronLeft className="size-5" aria-hidden />
      </Button>
      Preview
    </span>
  );
}

function Preview({ statement, cardRef, canShare, labelled }: { statement: ShareStatement; cardRef: React.Ref<HTMLDivElement>; canShare: boolean; labelled: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {labelled && <span className="font-heading text-xs font-semibold tracking-wider text-muted-foreground uppercase max-md:sr-only">Preview</span>}
      {canShare ? (
        <div className="flex justify-center">
          <ShareStatementCard ref={cardRef} statement={statement} />
        </div>
      ) : (
        <p className="rounded-2xl border border-border/60 bg-card px-5 py-10 text-center text-sm text-muted-foreground">Nothing selected.</p>
      )}
    </div>
  );
}

function Fields({ recipient, onRecipientChange, note, onNoteChange, wide }: Pick<Props, "recipient" | "onRecipientChange" | "note" | "onNoteChange"> & { wide: boolean }) {
  return (
    <div className={cn("grid gap-4", wide && "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-3")}>
      <Field label="Name" htmlFor="share-recipient" optional>
        <Input id="share-recipient" value={recipient} onChange={(e) => onRecipientChange(e.target.value)} placeholder="Who it's for" />
      </Field>
      <Field label="Note" htmlFor="share-note" optional hint={wide ? undefined : "Payment details, a due date … remembered for next time."}>
        <textarea
          id="share-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={wide ? 1 : 2}
          placeholder={wide ? "Payment details, a due date…" : undefined}
          className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </Field>
    </div>
  );
}

function useShareActions(statement: ShareStatement, blob: Blob | null, note: string, onDone: () => void) {
  const [phone] = useState(canShareImage);

  async function handleImage() {
    if (!blob) return;
    saveNote(note);
    try {
      if (phone) {
        if (await shareImage(blob, fileName(statement), statementText(statement))) onDone();
        return;
      }
      const how = await copyImage(blob, fileName(statement));
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

  return { phone, handleImage, handleText };
}

type FooterProps = {
  picking: boolean;
  stepped: boolean;
  summary: React.ReactNode;
  canShare: boolean;
  ready: boolean;
  phone: boolean;
  onText: () => void;
  onImage: () => void;
  onPreview: () => void;
};

/** Copy / share actions; on a phone's pick step they give way to "Preview statement". */
function Footer({ picking, stepped, summary, canShare, ready, phone, onText, onImage, onPreview }: FooterProps) {
  const pickStep = picking && !stepped;
  return (
    <FormFooter hint={stepped ? undefined : summary}>
      <Button type="button" variant="outline" disabled={!canShare} onClick={onText} className={cn(pickStep && "max-sm:hidden")}>
        Copy text
      </Button>
      <Button type="button" disabled={!canShare || !ready} onClick={onImage} className={cn(pickStep && "max-sm:hidden")}>
        {phone ? "Share image" : "Copy image"}
      </Button>
      {pickStep && (
        <Button type="button" disabled={!canShare} onClick={onPreview} className="sm:hidden">
          Preview statement
        </Button>
      )}
    </FormFooter>
  );
}

/**
 * Name + note fields, optional controls for what to include, a live preview
 * of the card, and share / copy actions.
 */
export function ShareStatementDialog({ open, onOpenChange, title, statement, children, summary, canShare = true, ...fields }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const picking = children != null;
  // Phones only: the pick step hides the preview, the preview step hides the rest.
  const stepped = picking && step === "preview";
  const blob = usePngOf(cardRef, `${JSON.stringify(statement)}|${step}`, open && canShare);
  const { phone, handleImage, handleText } = useShareActions(statement, blob, fields.note, () => onOpenChange(false));

  function handleOpenChange(next: boolean) {
    if (!next) setStep("pick");
    onOpenChange(next);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={stepped ? <PreviewTitle onBack={() => setStep("pick")} /> : title}
      size={picking ? "xl" : "md"}
      footer={<Footer picking={picking} stepped={stepped} summary={summary} canShare={canShare} ready={!!blob} phone={phone} onText={handleText} onImage={handleImage} onPreview={() => setStep("preview")} />}
    >
      {/* md+: the controls and the preview scroll on their own, so the preview stays in view. */}
      <div className={cn("grid gap-4", picking && "md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_25rem] md:grid-rows-[minmax(0,1fr)] md:gap-6")}>
        <div className={cn("flex min-w-0 flex-col gap-4", picking && "md:-m-1 md:overflow-y-auto md:p-1", stepped && "max-sm:hidden")}>
          <Fields {...fields} wide={picking} />
          {children}
        </div>
        <div className={cn(picking && "md:overflow-y-auto", picking && !stepped && "max-sm:hidden")}>
          <Preview statement={statement} cardRef={cardRef} canShare={canShare} labelled={picking} />
        </div>
      </div>
    </FormDialog>
  );
}
