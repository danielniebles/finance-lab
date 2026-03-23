"use client";

import { useRef, useState, useTransition } from "react";
import { importMoneyLoverFile } from "@/lib/actions/import";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";

export function ImportForm() {
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

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        name="file"
        accept=".xlsx"
        required
        className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm file:font-medium"
      />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        Import
      </Button>
      {message && (
        <span
          className={`text-sm ${message.type === "error" ? "text-destructive" : "text-green-600"}`}
        >
          {message.text}
        </span>
      )}
    </form>
  );
}
