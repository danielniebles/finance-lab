"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import { useLoanForm } from "./hooks/use-loan-form";

function AccountDot({ color }: { color: string | null }) {
  return (
    <span
      className="size-2.5 rounded-full inline-block"
      style={{ backgroundColor: color ?? "#888" }}
    />
  );
}

function AccountTriggerLabel({ name, color }: { name: string; color: string | null }) {
  return (
    <span className="text-sm flex items-center gap-2">
      <AccountDot color={color} />
      {name}
    </span>
  );
}

function AccountSelectItem({ id, name, color }: { id: string; name: string; color: string | null }) {
  return (
    <SelectItem value={id}>
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: color ?? "#888" }} />
        {name}
      </span>
    </SelectItem>
  );
}

export function LoanForm({
  open,
  onClose,
  accounts,
  debtors,
  defaultDebtorId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  defaultDebtorId?: string;
  editing?: LoanWithRemaining | null;
}) {
  const {
    debtorId, setDebtorId,
    accountId, setAccountId,
    amount, setAmount,
    date, setDate,
    expectedBy, setExpectedBy,
    notes, setNotes,
    pending,
    handleSubmit,
    selectedDebtor,
    selectedAccount,
  } = useLoanForm({ accounts, debtors, defaultDebtorId, editing, onClose });

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit loan" : "Record new loan"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Debtor</Label>
            {editing ? (
              <p className="text-sm px-3 py-2 rounded-md border border-border bg-muted/30 text-muted-foreground">
                {selectedDebtor?.name ?? debtorId}
              </p>
            ) : (
              <Select value={debtorId} onValueChange={(v) => v && setDebtorId(v)}>
                <SelectTrigger className="h-9">
                  <span className="text-sm">{selectedDebtor?.name ?? "Select debtor…"}</span>
                </SelectTrigger>
                <SelectContent>
                  {debtors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>From account</Label>
            <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
              <SelectTrigger className="h-9">
                {selectedAccount
                  ? <AccountTriggerLabel name={selectedAccount.name} color={selectedAccount.color} />
                  : <span className="text-sm">Select account…</span>
                }
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <AccountSelectItem key={a.id} id={a.id} name={a.name} color={a.color} />
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (COP)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000000"
                min={1}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Expected repayment (optional)</Label>
            <Input type="date" value={expectedBy} onChange={(e) => setExpectedBy(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending || !debtorId || !accountId}>
              {editing ? "Save" : "Record loan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
