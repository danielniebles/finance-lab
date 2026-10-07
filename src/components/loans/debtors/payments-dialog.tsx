"use client";

import { ColorDot, FormDialog, FormFooter, Money } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { RowDeleteButton } from "@/components/shared/row-delete-button";
import { deleteLoanPayment } from "@/lib/actions/loans";
import type { DebtorWithLoans } from "@/lib/queries/loans";
import { formatStoredDate } from "@/lib/format";

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
  const date = formatStoredDate(p.date, { month: "short", day: "numeric", year: "2-digit" });
  return (
    <li className="group/row flex items-center gap-3 px-5 py-2.5">
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
      <RowDeleteButton
        label="Delete payment"
        onDelete={onDelete}
        disabled={pending}
        className="sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
      />
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
    <FormDialog
      open={!!debtor}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={`${debtor?.name ?? ""} · payments`}
      description={
        payments.length > 0 ? (
          <>
            {payments.length} payment{payments.length === 1 ? "" : "s"} · <Money value={total} tone="positive" /> in total
          </>
        ) : undefined
      }
      footer={
        <FormFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </FormFooter>
      }
    >
      {payments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="-mx-5 divide-y divide-border/40">
          {payments.map((p) => (
            <PaymentRow
              key={p.id}
              p={p}
              pending={deletePaymentPending}
              onDelete={() => startDeletePayment(async () => { await deleteLoanPayment(p.id); })}
            />
          ))}
        </ul>
      )}
    </FormDialog>
  );
}
