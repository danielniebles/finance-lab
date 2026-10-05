import { Meter, Money, ReadingGrid } from "@/components/ds";
import { MASK } from "@/components/loans/lib/constants";
import { dueLabel } from "@/lib/installment-display";
import type { CreditCardSummary, MonthSummary } from "@/lib/queries/installments";
import { TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";

function Amount({ value, masked, className }: { value: number; masked: boolean; className?: string }) {
  return masked ? <span className={cn("font-mono", className)}>{MASK}</span> : <Money value={value} className={className} />;
}

// "Still due this month" hero — replaces the five-cell KPI band. The paid
// share is a meter; total debt and the next card due sit beside it.
export function InstallmentsSummary({
  summary,
  nextDue,
  month,
  year,
  masked,
}: {
  summary: MonthSummary;
  nextDue: { card: CreditCardSummary; amount: number } | null;
  month: number;
  year: number;
  masked: boolean;
}) {
  const { totalObligation, totalPaid, totalDue, activeCount, totalRemainingDebt, dueThisMonth } = summary;
  const paidCount = dueThisMonth.filter((d) => d.payment !== null).length;
  const pct = totalObligation > 0 ? (totalPaid / totalObligation) * 100 : 100;
  const next = nextDue ? dueLabel(nextDue.card.paymentDueDay, month, year) : null;
  const done = totalDue <= 0;

  return (
    <section className="surface-glow grid gap-6 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 lg:grid-cols-2 lg:items-center">
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Still due this month
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Amount value={totalDue} masked={masked} className={cn("text-4xl font-semibold leading-none max-sm:text-3xl", done && TONE_CLASSES.positive.text)} />
          <span className="text-sm text-muted-foreground">
            of <Amount value={totalObligation} masked={masked} className="text-foreground" />
          </span>
        </div>
        <Meter label="Paid this month" value={pct} max={100} tone="positive" />
        <span className="text-xs text-muted-foreground">
          <Amount value={totalPaid} masked={masked} className={TONE_CLASSES.positive.text} /> paid · {paidCount} of {dueThisMonth.length} payments
        </span>
      </div>
      <ReadingGrid
        items={[
          {
            label: `Total debt left · ${activeCount} active`,
            value: <Amount value={totalRemainingDebt} masked={masked} />,
          },
          {
            label: "Next card due",
            value: nextDue && next ? (
              <span className={cn("flex flex-wrap items-baseline gap-x-2", TONE_CLASSES[next.tone].text)}>
                <span className="font-sans">
                  {nextDue.card.name} · {next.label.replace(/^Due /, "")}
                </span>
                <Amount value={nextDue.amount} masked={masked} className="text-xs font-normal text-muted-foreground" />
              </span>
            ) : (
              <span className={cn("font-sans", TONE_CLASSES.positive.text)}>All paid</span>
            ),
          },
        ]}
      />
    </section>
  );
}
