"use client";

import { useState, useMemo } from "react";
import { PageHeader, SectionHeader } from "@/components/ds";
import { PrivacyToggle } from "@/components/shared/privacy-toggle";
import { cardStatus, nextCardDue } from "@/lib/installment-display";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { MonthNav } from "./month-nav";
import { InstallmentActions } from "./installment-actions";
import { InstallmentsSummary } from "./installments-summary";
import { DueThisMonthTable } from "./due-this-month-table";
import { AllInstallmentsTable } from "./all-installments-table";
import { CreditCardTile } from "./credit-card-tile";
import { CreditCardManager } from "./credit-card-manager";
import { computeMonthSummary } from "@/lib/installment-utils";
import type { InstallmentRow, MonthSummary, CreditCardSummary } from "@/lib/queries/installments";
import type { WalletOption } from "@/components/shared/wallet-select";
import type { CategoryOption } from "@/lib/queries/expenses";

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
  walletOptions: WalletOption[];
  categories: CategoryOption[];
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
  walletOptions,
  categories,
}: Props) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [cardManagerOpen, setCardManagerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  function handlePrivacyToggle() {
    setPrivacyMode((prev) => !prev);
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Installments"
        description="Credit card installment tracker"
        controls={
          <>
            <PrivacyToggle on={privacyMode} onToggle={handlePrivacyToggle} />
            <MonthNav month={month} year={year} />
          </>
        }
        action={<InstallmentActions formCards={formCards} formDebtors={formDebtors} formAccounts={formAccounts} />}
      />

      <InstallmentsSummary
        summary={activeSummary}
        nextDue={nextCardDue(cards, activeSummary.dueThisMonth)}
        month={month}
        year={year}
        masked={privacyMode}
      />

      {/* Credit cards — click one to filter the whole page to it */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Credit cards"
          trailing={
            <Button variant="outline" size="sm" onClick={() => setCardManagerOpen(true)}>
              Manage cards
            </Button>
          }
        />
        {cards.length > 0 ? (
          <Carousel opts={{ align: "start" }}>
            <CarouselContent>
              {cards.map((c) => (
                // py-1: room for the selected tile's border — the viewport's
                // overflow-hidden otherwise clips it at the top/bottom edge.
                <CarouselItem key={c.id} className="basis-auto py-1">
                  <CreditCardTile
                    card={c}
                    status={cardStatus(c, summary.dueThisMonth, month, year)}
                    masked={privacyMode}
                    selected={selectedCardId === null ? undefined : selectedCardId === c.id}
                    onCardClick={() => handleCardClick(c.id)}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <p className="text-sm text-muted-foreground">
            No credit cards yet. Add one via{" "}
            <button
              onClick={() => setCardManagerOpen(true)}
              className="underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Manage cards
            </button>
            .
          </p>
        )}
      </section>

      {/* Due this month — unpaid first, paid folded away */}
      <section className="flex flex-col gap-3">
        <SectionHeader title={`To pay this month · ${activeSummary.dueThisMonth.filter((d) => d.payment === null).length}`} />
        {activeSummary.dueThisMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">No installments due this month.</p>
        ) : (
          <DueThisMonthTable
            dueThisMonth={activeSummary.dueThisMonth}
            totalObligation={activeSummary.totalObligation}
            cardDueDays={new Map(cards.map((c) => [c.id, c.paymentDueDay]))}
            month={month}
            year={year}
            walletOptions={walletOptions}
            categories={categories}
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
