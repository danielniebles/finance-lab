"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addVaultEntry } from "@/lib/actions/vaults";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountOption } from "@/lib/queries/accounts";

// ─── Props ────────────────────────────────────────────────────────────────────

type Direction = "contribute" | "withdraw";

type Props = {
  open: boolean;
  direction: Direction;
  vaultId: string;
  vaultName: string;
  currentBalance: number;
  onClose: () => void;
  accounts: AccountOption[];
};

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  amount: string;
  date: string;
  notes: string;
  sourceAccountId: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: FormState = {
  amount: "",
  date: today(),
  notes: "",
  sourceAccountId: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EntryForm({
  open,
  direction: initialDirection,
  vaultId,
  vaultName,
  currentBalance,
  onClose,
  accounts,
}: Props) {
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose();
    else {
      setDirection(initialDirection);
      setForm({ ...EMPTY_FORM, date: today(), sourceAccountId: "" });
      setError(null);
    }
  }

  function handleClose() {
    setForm({ ...EMPTY_FORM, date: today(), sourceAccountId: "" });
    setError(null);
    onClose();
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const parsedAmount = parseFloat(form.amount);
  const wouldOverdraw =
    direction === "withdraw" &&
    !isNaN(parsedAmount) &&
    parsedAmount > currentBalance;

  const selectedAccount = accounts.find((a) => a.id === form.sourceAccountId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || isNaN(parsedAmount) || parsedAmount <= 0) return;
    setError(null);

    const signedAmount = direction === "contribute" ? parsedAmount : -parsedAmount;
    const entryDate = form.date ? new Date(form.date) : undefined;
    const notes = form.notes.trim() || undefined;
    const sourceAccountId = form.sourceAccountId || undefined;

    startTransition(async () => {
      try {
        await addVaultEntry(vaultId, signedAmount, entryDate, notes, sourceAccountId);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            {direction === "contribute" ? "Contribute to" : "Withdraw from"}{" "}
            <span className="text-primary">{vaultName}</span>
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
          {/* Direction toggle */}
          <div className="flex gap-2" role="radiogroup" aria-label="Entry type">
            <button
              type="button"
              role="radio"
              aria-checked={direction === "contribute"}
              disabled={pending}
              className={cn(
                "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
                direction === "contribute"
                  ? "bg-success/10 text-success ring-1 ring-success/30"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
              )}
              onClick={() => setDirection("contribute")}
            >
              + Contribute
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={direction === "withdraw"}
              disabled={pending}
              className={cn(
                "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
                direction === "withdraw"
                  ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
              )}
              onClick={() => setDirection("withdraw")}
            >
              − Withdraw
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label
              htmlFor="entry-amount"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Amount (COP)
            </Label>
            <Input
              id="entry-amount"
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="200000"
              required
              disabled={pending}
              aria-describedby={
                direction === "withdraw" && currentBalance > 0
                  ? "entry-amount-hint"
                  : undefined
              }
            />
            {direction === "withdraw" && currentBalance > 0 && (
              <p id="entry-amount-hint" className="text-xs text-muted-foreground">
                Current balance:{" "}
                <span className="font-mono tabular-nums">
                  {formatCOP(currentBalance)}
                </span>
              </p>
            )}
            {wouldOverdraw && (
              <p className="text-xs text-warning" role="alert">
                This withdrawal would exceed your balance.
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label
              htmlFor="entry-date"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Date
            </Label>
            <Input
              id="entry-date"
              type="date"
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
              disabled={pending}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label
              htmlFor="entry-notes"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Notes{" "}
              <span className="text-muted-foreground font-normal normal-case tracking-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="entry-notes"
              type="text"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="e.g. Salary transfer"
              disabled={pending}
            />
          </div>

          {/* From account — contributions only */}
          {direction === "contribute" && accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label
                htmlFor="entry-source-account"
                className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                From account{" "}
                <span className="text-muted-foreground font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </Label>
              <Select
                value={form.sourceAccountId}
                onValueChange={(v) => setField("sourceAccountId", v ?? "")}
              >
                <SelectTrigger id="entry-source-account" className="h-9" disabled={pending}>
                  <span className="text-sm">
                    {selectedAccount ? selectedAccount.name : "None (notional)"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (notional)</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} — {formatCOP(acc.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-xs text-muted-foreground">
                  Moves {parsedAmount > 0 ? formatCOP(parsedAmount) : "this amount"} out of{" "}
                  {selectedAccount.name}&apos;s available balance.
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className={
                direction === "withdraw"
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0 shadow-none"
                  : ""
              }
            >
              {pending
                ? "Saving…"
                : direction === "contribute"
                ? "Record contribution"
                : "Record withdrawal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
