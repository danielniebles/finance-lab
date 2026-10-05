import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Money, SectionHeader, StatusChip } from "@/components/ds";
import type { DueThisMonth } from "@/lib/queries/installments";
import { Panel, ReadingGrid } from "./panel";

const MAX_ROWS = 5;

function DueRow({ due }: { due: DueThisMonth }) {
  const paid = due.payment !== null;
  const Icon = paid ? CheckCircle2 : Circle;
  return (
    <li className="flex min-h-10 items-center gap-3">
      <Icon className={paid ? "size-4 shrink-0 text-success" : "size-4 shrink-0 text-muted-foreground"} aria-hidden />
      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        {due.installment.cardColor && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            // Card color is user data, not a theme color.
            style={{ backgroundColor: due.installment.cardColor }}
          />
        )}
        <span className={paid ? "truncate text-muted-foreground" : "truncate"}>{due.installment.description}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {due.installmentNum}/{due.installment.numInstallments}
        </span>
      </span>
      <Money value={due.amount} className={paid ? "text-sm text-muted-foreground" : "text-sm"} />
    </li>
  );
}

export function ObligationsPanel({
  monthLabel,
  dueThisMonth,
  totalDue,
  totalObligation,
  inLoans,
  activeDebtors,
}: {
  monthLabel: string;
  dueThisMonth: DueThisMonth[];
  totalDue: number;
  totalObligation: number;
  inLoans: number;
  activeDebtors: number;
}) {
  // Unpaid first: they're the ones that need action.
  const ordered = [...dueThisMonth].sort((a, b) => Number(a.payment !== null) - Number(b.payment !== null));
  const shown = ordered.slice(0, MAX_ROWS);
  const paidCount = dueThisMonth.filter((d) => d.payment !== null).length;

  return (
    <Panel className="flex flex-col gap-4">
      <SectionHeader
        title={`Obligations · ${monthLabel}`}
        trailing={
          dueThisMonth.length > 0 ? (
            <StatusChip tone={totalDue > 0 ? "caution" : "positive"}>
              {paidCount} of {dueThisMonth.length} paid
            </StatusChip>
          ) : undefined
        }
      />
      <ReadingGrid
        className="grid-cols-2"
        items={[
          { label: "Installments still due", value: <Money value={totalDue} tone={totalDue > 0 ? "caution" : undefined} /> },
          { label: `Owed to you · ${activeDebtors}`, value: <Money value={inLoans} /> },
        ]}
      />
      {dueThisMonth.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing due this month.</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((d) => (
            <DueRow key={`${d.installment.id}-${d.installmentNum}`} due={d} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Month total <Money value={totalObligation} />
        </span>
        <span className="flex gap-3">
          <Link href="/installments" className="hover:text-foreground">
            {dueThisMonth.length > MAX_ROWS ? `All ${dueThisMonth.length} installments →` : "Installments →"}
          </Link>
          <Link href="/loans" className="hover:text-foreground">
            Loans →
          </Link>
        </span>
      </div>
    </Panel>
  );
}
