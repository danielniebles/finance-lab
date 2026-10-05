"use client";

import { Trash } from "lucide-react";
import { ColorDot, Money } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteLoanPayment } from "@/lib/actions/loans";
import type { DebtorWithLoans } from "@/lib/queries/loans";

type Payment = {
  id: string;
  amount: number;
  date: Date;
  notes: string | null;
  accountName: string;
  accountColor: string | null;
};

export function buildPaymentsLog(debtor: DebtorWithLoans): Payment[] {
  return debtor.loans
    .flatMap((l) => l.payments.map((p) => ({ ...p, accountName: l.accountName, accountColor: l.accountColor })))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function PaymentRow({ p, pending, onDelete }: { p: Payment; pending: boolean; onDelete: () => void }) {
  const date = new Date(p.date).toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" });
  return (
    <li className="group/row flex items-center gap-3 px-6 py-2.5 hover:bg-muted/20">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ColorDot color={p.accountColor} />
          <span className="truncate">
            {date} · {p.accountName}
          </span>
        </span>
        {p.notes && <span className="truncate text-sm">{p.notes}</span>}
      </span>
      <Money value={p.amount} signed tone="positive" className="shrink-0 text-sm font-medium" />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete payment"
        className="size-6 shrink-0 text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover/row:opacity-100"
        disabled={pending}
        onClick={onDelete}
      >
        <Trash className="size-3.5" />
      </Button>
    </li>
  );
}

export function DebtorPaymentsDialog({
  debtor,
  onClose,
  deletePaymentPending,
  startDeletePayment,
}: {
  debtor: DebtorWithLoans | null;
  onClose: () => void;
  deletePaymentPending: boolean;
  startDeletePayment: (fn: () => Promise<void>) => void;
}) {
  const payments = debtor ? buildPaymentsLog(debtor) : [];
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <Dialog open={!!debtor} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{debtor?.name} — Payment history</DialogTitle>
        </DialogHeader>
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {payments.length} payment{payments.length === 1 ? "" : "s"} · <Money value={total} tone="positive" /> in total
            </p>
            <ul className="-mx-6 max-h-[60vh] divide-y divide-border/40 overflow-y-auto">
              {payments.map((p) => (
                <PaymentRow
                  key={p.id}
                  p={p}
                  pending={deletePaymentPending}
                  onDelete={() => startDeletePayment(async () => { await deleteLoanPayment(p.id); })}
                />
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
