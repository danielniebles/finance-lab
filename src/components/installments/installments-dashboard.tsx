"use client";

import { useState, useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MonthNav } from "./month-nav";
import { DueThisMonthTable } from "./due-this-month-table";
import { AllInstallmentsTable } from "./all-installments-table";
import { CreditCardTile } from "./credit-card-tile";
import { CreditCardManager } from "./credit-card-manager";
import { computeMonthSummary } from "@/lib/installment-utils";
import type { InstallmentRow, MonthSummary, CreditCardSummary } from "@/lib/queries/installments";

// ─── StatInline ───────────────────────────────────────────────────────────────

function StatInline({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "good" | "bad" | "neutral";
}) {
  const valueColor =
    highlight === "good"
      ? "text-success"
      : highlight === "bad"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-base sm:text-xl font-semibold ${valueColor}`}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type Props = {
  month: number;
  year: number;
  allInstallments: InstallmentRow[];
  summary: MonthSummary;
  cards: CreditCardSummary[];
  formCards: { id: string; name: string; color: string | null }[];
  formDebtors: { id: string; name: string }[];
  formAccounts: { id: string; name: string }[];
};

export function InstallmentsDashboard({
  month,
  year,
  allInstallments,
  summary,
  cards,
  formCards,
  formDebtors,
  formAccounts,
}: Props) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [cardManagerOpen, setCardManagerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  function handlePrivacyToggle() {
    setPrivacyMode((prev) => !prev);
  }

  function handleEditCard() {
    setCardManagerOpen(true);
  }

  function handleCardClick(cardId: string) {
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  }

  const filteredInstallments = useMemo(
    () =>
      selectedCardId
        ? allInstallments.filter((i) => i.cardId === selectedCardId)
        : allInstallments,
    [allInstallments, selectedCardId],
  );

  const activeSummary = useMemo(
    () =>
      selectedCardId
        ? computeMonthSummary(month, year, filteredInstallments)
        : summary,
    [selectedCardId, filteredInstallments, month, year, summary],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Installments</h1>
          <p className="text-sm text-muted-foreground">Credit card installment tracker</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", privacyMode && "border-primary/50 text-primary")}
            onClick={handlePrivacyToggle}
            title={privacyMode ? "Exit privacy mode" : "Enter privacy mode"}
          >
            {privacyMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            Privacy
          </Button>
          <MonthNav month={month} year={year} />
        </div>
      </div>

      {/* Credit Overview — unified container */}
      <section
        aria-labelledby="credit-overview-heading"
        className="rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden"
      >
        {/* Top band — Credit Cards */}
        <div className="px-6 pt-5 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="credit-overview-heading"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Credit Cards
            </h2>
            <Button variant="outline" size="sm" onClick={() => setCardManagerOpen(true)}>
              Manage cards
            </Button>
          </div>
          {cards.length > 0 && (
            <div className="flex gap-3 overflow-x-auto py-1 -my-1 px-1">
              {cards.map((c) => (
                <CreditCardTile
                  key={c.id}
                  card={c}
                  masked={privacyMode}
                  onEdit={() => handleEditCard()}
                  onDelete={() => setCardManagerOpen(false)}
                  selected={selectedCardId === null ? undefined : selectedCardId === c.id}
                  onCardClick={() => handleCardClick(c.id)}
                />
              ))}
            </div>
          )}
          {cards.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No credit cards yet. Add one via{" "}
              <button
                onClick={() => setCardManagerOpen(true)}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Manage cards
              </button>
              .
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border" aria-hidden />


        {/* Bottom band — KPI stats */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border bg-muted/30 sm:grid-cols-5 sm:divide-y-0">
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <StatInline
              label="Total obligation"
              value={formatCOP(activeSummary.totalObligation)}
              sub="due this month"
            />
          </div>
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <StatInline
              label="Paid so far"
              value={formatCOP(activeSummary.totalPaid)}
              highlight={activeSummary.totalPaid > 0 ? "good" : "neutral"}
            />
          </div>
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <StatInline
              label="Still due"
              value={formatCOP(activeSummary.totalDue)}
              highlight={activeSummary.totalDue > 0 ? "bad" : "good"}
            />
          </div>
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <StatInline
              label="Active installments"
              value={String(activeSummary.activeCount)}
            />
          </div>
          <div className="px-4 py-3 sm:px-6 sm:py-4 col-span-2 sm:col-span-1">
            <StatInline
              label="Total debt"
              value={formatCOP(activeSummary.totalRemainingDebt)}
              sub="all remaining balances"
              highlight={activeSummary.totalRemainingDebt > 0 ? "bad" : "good"}
            />
          </div>
        </div>
      </section>

      {/* Due this month */}
      <section className="space-y-3">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Payments due this month
        </h2>
        {activeSummary.dueThisMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">No installments due this month.</p>
        ) : (
          <DueThisMonthTable
            dueThisMonth={activeSummary.dueThisMonth}
            totalObligation={activeSummary.totalObligation}
          />
        )}
      </section>

      {/* All installments */}
      <AllInstallmentsTable
        installments={filteredInstallments}
        formCards={formCards}
        formDebtors={formDebtors}
        formAccounts={formAccounts}
      />

      {/* Credit card manager dialog */}
      <CreditCardManager
        open={cardManagerOpen}
        onClose={() => setCardManagerOpen(false)}
        cards={cards}
      />
    </div>
  );
}
