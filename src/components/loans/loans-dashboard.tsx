"use client";

import { PageHeader, SectionHeader } from "@/components/ds";
import { PrivacyToggle } from "@/components/shared/privacy-toggle";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { LoansClient } from "./loans-client";
import { AccountCard } from "./account-card";
import { DebtorsSection } from "./debtors-section";
import type { LoansOverview } from "@/lib/queries/loans";
import { NetWorthCard } from "./net-worth-card";
import { usePrivacyMode } from "./hooks/use-privacy-mode";

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function LoansDashboard({ data }: { data: LoansOverview }) {
  const { privacyMode, revealedDebtorId, handleReveal, handlePrivacyToggle } =
    usePrivacyMode();

  const activeDebtorCount = data.debtors.filter((d) => d.totalOwed > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings & Loans"
        description="Account balances and outstanding loans"
        controls={
          <>
            <PrivacyToggle on={privacyMode} onToggle={handlePrivacyToggle} />
            <LoansClient accounts={data.accounts} debtors={data.debtors} mode="transfer" />
          </>
        }
        action={<LoansClient accounts={data.accounts} debtors={data.debtors} mode="new-loan" />}
      />

      <NetWorthCard data={data} masked={privacyMode} activeDebtorCount={activeDebtorCount} />

      {/* Accounts grid */}
      <section className="space-y-3">
        <SectionHeader
          title="Accounts"
          trailing={<LoansClient accounts={data.accounts} debtors={data.debtors} mode="add-account" />}
        />
        {data.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <>
            {/* Mobile: carousel — a vertically-stacked single column of full
                cards is a lot of scrolling; swipe through them instead. */}
            <Carousel opts={{ align: "start" }} className="sm:hidden">
              <CarouselContent>
                {data.accounts.map((a) => (
                  <CarouselItem key={a.id} className="basis-[85%]">
                    <AccountCard account={a} masked={privacyMode} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            <div className="hidden sm:grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.accounts.map((a) => (
                <AccountCard key={a.id} account={a} masked={privacyMode} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Debtors */}
      <DebtorsSection
        accounts={data.accounts}
        debtors={data.debtors}
        totalEverLent={data.totalEverLent}
        totalRecovered={data.totalRecovered}
        privacyMode={privacyMode}
        revealedDebtorId={revealedDebtorId}
        onReveal={handleReveal}
      />
    </div>
  );
}
