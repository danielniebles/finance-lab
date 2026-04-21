"use client";

import { useRef, useState, useTransition } from "react";
import { importMoneyLoverFile } from "@/lib/actions/import";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";

export function ImportForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);

    startTransition(async () => {
      const result = await importMoneyLoverFile(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: `Imported ${result.count} transactions for ${result.month}/${result.year}.`,
        });
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) setMessage(null);
    setOpen(next);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Import
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import MoneyLover export</DialogTitle>
          </DialogHeader>

          <form id="import-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                Select an <span className="font-medium text-foreground">.xlsx</span> file
                exported from MoneyLover. Re-importing the same month replaces existing data.
              </p>
              <input
                ref={fileRef}
                type="file"
                name="file"
                accept=".xlsx"
                required
                className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm file:font-medium"
              />
            </div>

            {message && (
              <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-success"}`}>
                {message.text}
              </p>
            )}
          </form>

          <DialogFooter showCloseButton>
            <Button type="submit" form="import-form" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
