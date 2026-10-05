"use client";

import { useState } from "react";
import { Meter, Money, StatusChip } from "@/components/ds";
import { sortInstallments } from "@/lib/installment-display";
import { cn } from "@/lib/utils";
import { InstallmentActions } from "./installment-actions";
import { InstallmentForm } from "./installment-form";
import type { InstallmentRow } from "@/lib/queries/installments";

type FormData = {
  formCards: { id: string; name: string; color: string | null }[];
  formDebtors: { id: string; name: string }[];
  formAccounts: { id: string; name: string }[];
};

type Props = {
  installments: InstallmentRow[];
} & Partial<FormData>;

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(160px,1.6fr)_repeat(2,minmax(96px,1fr))_minmax(120px,1.1fr)_minmax(96px,1fr)]";
const HEAD = "font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground";

function endsLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '");
}

// One row per installment, same layout at every width (no separate mobile
// markup): name / card dot · rate · ends · Total · Monthly · progress ·
// Remaining. On phones Total and Monthly drop out and progress wraps under
// the name. Clicking opens the edit form, as before.
function InstallmentRowItem({ inst, formCards, formDebtors, formAccounts }: { inst: InstallmentRow } & FormData) {
  const [open, setOpen] = useState(false);
  const finished = inst.status === "Finished";
  const pct = inst.numInstallments > 0 ? (inst.installmentsPaid / inst.numInstallments) * 100 : 0;
  const meta = [
    inst.monthlyInterestRate != null ? `${inst.monthlyInterestRate.toFixed(2)}% m.v.` : null,
    `ends ${endsLabel(inst.endDate)}`,
  ].filter(Boolean);

  return (
    <li className="border-t border-border/40 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(ROW_GRID, "w-full text-left text-sm transition-colors hover:bg-muted/30", finished && "opacity-60")}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{inst.description}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {inst.cardName ? (
              <>
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  // Card colour is user data.
                  style={{ backgroundColor: inst.cardColor ?? "var(--muted-foreground)" }}
                />
                <span className="shrink-0">{inst.cardName}</span>
              </>
            ) : (
              <span className="shrink-0">No card</span>
            )}
            <span className="truncate">· {meta.join(" · ")}</span>
          </span>
        </span>
        <Money value={inst.totalAmount} className="text-right max-sm:hidden" />
        <span className="text-right text-muted-foreground max-sm:hidden">
          <Money value={inst.monthlyAmount} />
          {inst.monthlyInterestRate != null && <span className="ml-1 text-xs">+int</span>}
        </span>
        <span className="flex items-center gap-2 max-sm:order-last max-sm:col-span-2">
          <Meter label={`${inst.description} payments made`} value={pct} max={100} tone={finished ? "positive" : "info"} size="sm" />
          <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {inst.installmentsPaid}/{inst.numInstallments}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5 text-right">
          {finished ? <StatusChip tone="positive">Finished</StatusChip> : <Money value={inst.remaining} className="font-semibold" />}
          {/* Phones drop the Total column, so show the total under Remaining. */}
          <span className="text-xs text-muted-foreground sm:hidden">
            of <Money value={inst.totalAmount} />
          </span>
        </span>
      </button>
      <InstallmentForm
        open={open}
        onClose={() => setOpen(false)}
        editing={inst}
        cards={formCards}
        debtors={formDebtors}
        accounts={formAccounts}
      />
    </li>
  );
}

export function AllInstallmentsTable({
  installments,
  formCards = [],
  formDebtors = [],
  formAccounts = [],
}: Props) {
  const [showFinished, setShowFinished] = useState(false);

  const finishedCount = installments.filter((i) => i.status === "Finished").length;
  const visible = showFinished
    ? installments
    : installments.filter((i) => i.status === "Active");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          All installments · {installments.filter((i) => i.status === "Active").length} active
        </h2>
        <div className="flex items-center gap-3">
          {finishedCount > 0 && (
            <button
              onClick={() => setShowFinished((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFinished ? "Hide finished" : `Show finished (${finishedCount})`}
            </button>
          )}
          <InstallmentActions
            formCards={formCards}
            formDebtors={formDebtors}
            formAccounts={formAccounts}
          />
        </div>
      </div>

      {installments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No installments yet. Add one above.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active installments.{" "}
          <button
            onClick={() => setShowFinished(true)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Show finished ({finishedCount})
          </button>
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className={cn(ROW_GRID, "bg-muted/40 py-2.5 max-sm:hidden")}>
            <span className={HEAD}>Item</span>
            <span className={cn(HEAD, "text-right")}>Total</span>
            <span className={cn(HEAD, "text-right")}>Monthly</span>
            <span className={HEAD}>Progress</span>
            <span className={cn(HEAD, "text-right")}>Remaining</span>
          </div>
          <ul className="border-t border-border/40">
            {sortInstallments(visible).map((inst) => (
              <InstallmentRowItem
                key={inst.id}
                inst={inst}
                formCards={formCards}
                formDebtors={formDebtors}
                formAccounts={formAccounts}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
