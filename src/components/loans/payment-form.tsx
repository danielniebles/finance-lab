"use client";

import { useState, useActionState, useMemo } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { recordPayment } from "@/lib/actions/loans";
import { formatCOP } from "@/lib/format";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";

type FormState = { error?: string } | null;
type FifoEntry = { loan: DebtorWithLoans["loans"][0]; apply: number };

// ─── Pure helper ──────────────────────────────────────────────────────────────

function computeFifoPreview(
  debtor: DebtorWithLoans | undefined,
  accountId: string,
  amount: string,
): FifoEntry[] {
  if (!debtor || !amount) return [];
  const total = parseFloat(amount);
  if (isNaN(total) || total <= 0) return [];
  const activeLoans = debtor.loans
    .filter((l) => l.isActive && (!accountId || l.accountId === accountId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let left = total;
  return activeLoans.map((l) => {
    if (left <= 0) return null;
    const apply = Math.min(left, l.remaining);
    left -= apply;
    return { loan: l, apply };
  }).filter(Boolean) as FifoEntry[];
}

// ─── Submit button ────────────────────────────────────────────────────────────

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Saving…" : "Record payment"}
    </Button>
  );
}

// ─── Account select field ─────────────────────────────────────────────────────

function AccountSelectField({
  accounts,
  accountId,
  onValueChange,
}: {
  accounts: AccountWithBalance[];
  accountId: string;
  onValueChange: (v: string) => void;
}) {
  const selected = accounts.find((a) => a.id === accountId);

  return (
    <div className="space-y-1.5">
      <Label>Account <span className="text-muted-foreground font-normal">(optional — leave blank for all)</span></Label>
      <Select value={accountId} onValueChange={(v) => onValueChange(v ?? "")}>
        <SelectTrigger className="h-9">
          <span className="text-sm flex items-center gap-2">
            {selected ? (
              <>
                <span className="size-2 rounded-full" style={{ backgroundColor: selected.color ?? "#888" }} />
                {selected.name}
              </>
            ) : (
              <span className="text-muted-foreground">All accounts</span>
            )}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All accounts</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: a.color ?? "#888" }} />
                {a.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── FIFO preview ─────────────────────────────────────────────────────────────

function FifoPreview({
  preview,
  selectedAccount,
}: {
  preview: FifoEntry[];
  selectedAccount: AccountWithBalance | undefined;
}) {
  if (preview.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Allocation preview — {selectedAccount ? selectedAccount.name : "all accounts"}, newest first
      </p>
      {preview.map(({ loan, apply }) => (
        <div key={loan.id} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {new Date(loan.date).toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "numeric" })}
            <span className="text-muted-foreground/50 ml-1">· {loan.accountName}</span>
          </span>
          <span className="font-mono text-success">+{formatCOP(apply)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Payment form ─────────────────────────────────────────────────────────────

export function PaymentForm({
  open,
  onClose,
  accounts,
  debtors,
  defaultDebtorId,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  defaultDebtorId?: string;
}) {
  const [debtorId, setDebtorId] = useState(defaultDebtorId ?? "");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");

  const debtor = debtors.find((d) => d.id === debtorId);

  const relevantAccounts = useMemo(() => {
    if (!debtor) return [];
    const ids = new Set(debtor.loans.filter((l) => l.isActive).map((l) => l.accountId));
    return accounts.filter((a) => ids.has(a.id));
  }, [debtor, accounts]);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  const preview = useMemo(
    () => computeFifoPreview(debtor, accountId, amount),
    [debtor, accountId, amount],
  );

  const [state, action] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      try {
        const date = formData.get("date") as string;
        const notes = (formData.get("notes") as string).trim() || undefined;
        await recordPayment({
          debtorId,
          accountId: accountId || undefined,
          totalAmount: parseFloat(amount),
          date: new Date(date + "T12:00:00"),
          notes,
        });
        onClose();
        return null;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Something went wrong" };
      }
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Debtor</Label>
            <Select value={debtorId} onValueChange={(v) => v && setDebtorId(v)}>
              <SelectTrigger className="h-9">
                <span className="text-sm">
                  {debtor ? `${debtor.name} — owes ${formatCOP(debtor.totalOwed)}` : "Select debtor…"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {debtors.filter((d) => d.totalOwed > 0).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} — {formatCOP(d.totalOwed)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {relevantAccounts.length > 1 && (
            <AccountSelectField
              accounts={relevantAccounts}
              accountId={accountId}
              onValueChange={setAccountId}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount received (COP)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="800000"
                min={1}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>

          <FifoPreview preview={preview} selectedAccount={selectedAccount} />

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Optional notes" />
          </div>

          {state?.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <SubmitButton disabled={!debtorId || !amount} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
