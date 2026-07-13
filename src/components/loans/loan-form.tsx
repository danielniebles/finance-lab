"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { deleteLoan } from "@/lib/actions/loans";
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

function LoanDeleteConfirm({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-destructive">
        Delete this loan? All payment records will also be removed.
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} autoFocus>
          Cancel
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
          Confirm delete
        </Button>
      </DialogFooter>
    </div>
  );
}

type LoanFormFieldsProps = {
  editing?: LoanWithRemaining | null;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  debtorId: string; setDebtorId: (v: string) => void;
  accountId: string; setAccountId: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  date: string; setDate: (v: string) => void;
  expectedBy: string; setExpectedBy: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  pending: boolean;
  selectedDebtor?: DebtorWithLoans;
  selectedAccount?: AccountWithBalance;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onDeleteRequest: () => void;
};

function LoanFormFields({
  editing, accounts, debtors,
  debtorId, setDebtorId, accountId, setAccountId,
  amount, setAmount, date, setDate,
  expectedBy, setExpectedBy, notes, setNotes,
  pending, selectedDebtor, selectedAccount,
  onSubmit, onClose, onDeleteRequest,
}: LoanFormFieldsProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
        {editing && (
          <Button
            type="button"
            variant="destructive"
            className="sm:mr-auto"
            disabled={pending}
            onClick={onDeleteRequest}
          >
            Delete
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending || !debtorId || !accountId}>
          {editing ? "Save" : "Record loan"}
        </Button>
      </DialogFooter>
    </form>
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

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, startDelete] = useTransition();

  // Reset the delete-confirm sub-view whenever the dialog (re)opens.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setConfirmingDelete(false);
  }

  function handleDelete() {
    if (!editing) return;
    startDelete(async () => {
      await deleteLoan(editing.id);
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {confirmingDelete ? "Delete loan?" : editing ? "Edit loan" : "Record new loan"}
          </DialogTitle>
        </DialogHeader>
        {confirmingDelete ? (
          <LoanDeleteConfirm
            pending={deletePending}
            onConfirm={handleDelete}
            onCancel={() => setConfirmingDelete(false)}
          />
        ) : (
          <LoanFormFields
            editing={editing}
            accounts={accounts}
            debtors={debtors}
            debtorId={debtorId} setDebtorId={setDebtorId}
            accountId={accountId} setAccountId={setAccountId}
            amount={amount} setAmount={setAmount}
            date={date} setDate={setDate}
            expectedBy={expectedBy} setExpectedBy={setExpectedBy}
            notes={notes} setNotes={setNotes}
            pending={pending}
            selectedDebtor={selectedDebtor}
            selectedAccount={selectedAccount}
            onSubmit={handleSubmit}
            onClose={onClose}
            onDeleteRequest={() => setConfirmingDelete(true)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
