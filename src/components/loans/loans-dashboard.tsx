"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Savings & Loans</h1>
          <p className="text-sm text-muted-foreground">Account balances and outstanding loans</p>
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
          <LoansClient accounts={data.accounts} debtors={data.debtors} mode="action-bar" />
        </div>
      </div>

      <NetWorthCard data={data} masked={privacyMode} activeDebtorCount={activeDebtorCount} />

      {/* Accounts grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Accounts
          </h2>
          <LoansClient accounts={data.accounts} debtors={data.debtors} mode="add-account" />
        </div>
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
