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
import type { AccountWithWallets } from "@/lib/queries/wallets";
import type { CategoryOption } from "@/lib/queries/expenses";

// ─── Props ────────────────────────────────────────────────────────────────────

type Direction = "contribute" | "withdraw";

type Props = {
  open: boolean;
  direction: Direction;
  vaultId: string;
  vaultName: string;
  currentBalance: number;
  onClose: () => void;
  walletAccounts: AccountWithWallets[];
  categories: CategoryOption[];
};

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  amount: string;
  date: string;
  notes: string;
  walletId: string;
  appCategoryId: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: FormState = {
  amount: "",
  date: today(),
  notes: "",
  walletId: "",
  appCategoryId: "",
};

type WalletChoice = { id: string; label: string; balance: number };

function flattenWalletChoices(walletAccounts: AccountWithWallets[]): WalletChoice[] {
  return walletAccounts.flatMap((account) =>
    account.wallets.map((wallet) => ({
      id: wallet.id,
      label: `${account.name} — ${wallet.name}`,
      balance: wallet.balance,
    })),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EntryForm({
  open,
  direction: initialDirection,
  vaultId,
  vaultName,
  currentBalance,
  onClose,
  walletAccounts,
  categories,
}: Props) {
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose();
    else {
      setDirection(initialDirection);
      setForm(EMPTY_FORM);
      setError(null);
    }
  }

  function handleClose() {
    setForm(EMPTY_FORM);
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

  const walletChoices = flattenWalletChoices(walletAccounts);
  const selectedWallet = walletChoices.find((w) => w.id === form.walletId);
  const needsCategory = direction === "contribute" && form.walletId !== "";
  const selectedCategory = categories.find((c) => c.id === form.appCategoryId);

  const canSubmit =
    !!form.amount &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    (!needsCategory || form.appCategoryId !== "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    const signedAmount = direction === "contribute" ? parsedAmount : -parsedAmount;
    const entryDate = form.date ? new Date(form.date) : undefined;
    const notes = form.notes.trim() || undefined;
    const walletId = direction === "contribute" && form.walletId ? form.walletId : undefined;
    const appCategoryId = walletId ? form.appCategoryId : undefined;

    startTransition(async () => {
      try {
        await addVaultEntry(vaultId, signedAmount, { date: entryDate, notes, walletId, appCategoryId });
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

          {/* From wallet — contributions only */}
          {direction === "contribute" && walletChoices.length > 0 && (
            <div className="space-y-1.5">
              <Label
                htmlFor="entry-wallet"
                className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                From wallet{" "}
                <span className="text-muted-foreground font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </Label>
              <Select
                value={form.walletId}
                onValueChange={(v) => setField("walletId", v ?? "")}
              >
                <SelectTrigger id="entry-wallet" className="h-9" disabled={pending}>
                  <span className="text-sm">
                    {selectedWallet ? selectedWallet.label : "None (notional)"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (notional)</SelectItem>
                  {walletChoices.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.label} — {formatCOP(w.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedWallet && (
                <p className="text-xs text-muted-foreground">
                  Records a {parsedAmount > 0 ? formatCOP(parsedAmount) : "matching"} expense against{" "}
                  {selectedWallet.label} — reduces its balance like any other spend.
                </p>
              )}
            </div>
          )}

          {/* Category — required once a wallet is chosen */}
          {needsCategory && (
            <div className="space-y-1.5">
              <Label
                htmlFor="entry-category"
                className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Category
              </Label>
              <Select
                value={form.appCategoryId}
                onValueChange={(v) => setField("appCategoryId", v ?? "")}
              >
                <SelectTrigger id="entry-category" className="h-9" disabled={pending}>
                  <span className="text-sm">
                    {selectedCategory ? selectedCategory.name : "Choose a category"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={pending || !canSubmit}
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
