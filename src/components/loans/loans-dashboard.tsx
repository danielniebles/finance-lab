"use client";

import { useState } from "react";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoansClient } from "./loans-client";
import { AccountCard } from "./account-card";
import { DebtorsSection } from "./debtors-section";
import type { LoansOverview } from "@/lib/queries/loans";
import { MASK } from "./privacy";

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, highlight, warn,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "good" | "bad" | "neutral";
  warn?: boolean;
}) {
  const color = highlight === "good" ? "text-success" : highlight === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2">
        <p className={cn("font-mono text-lg font-semibold", color)}>{value}</p>
        {warn && <AlertTriangle className="size-4 text-warning mb-0.5 shrink-0" />}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function LoansDashboard({ data }: { data: LoansOverview }) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [revealedDebtorId, setRevealedDebtorId] = useState<string | null>(null);

  const liquidityWarn = !privacyMode && data.liquidityRatio !== null && data.liquidityRatio < 10;
  const activeDebtorCount = data.debtors.filter((d) => d.totalOwed > 0).length;

  function handleReveal(id: string) {
    setRevealedDebtorId((prev) => (prev === id ? null : id));
  }

  function handlePrivacyToggle() {
    if (privacyMode) setRevealedDebtorId(null);
    setPrivacyMode((prev) => !prev);
  }

  return (
    <div className="space-y-8">
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
            {privacyMode ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            Privacy
          </Button>
          <LoansClient accounts={data.accounts} debtors={data.debtors} mode="action-bar" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Available"
          value={privacyMode ? MASK : formatCOP(data.available)}
          sub="liquid accounts"
          highlight={privacyMode ? "neutral" : data.available >= 0 ? "neutral" : "bad"}
        />
        <KpiCard
          label="In Loans"
          value={privacyMode ? MASK : formatCOP(data.inLoans)}
          sub={`${activeDebtorCount} active debtor${activeDebtorCount !== 1 ? "s" : ""}`}
        />
        <KpiCard
          label="Total Savings"
          value={privacyMode ? MASK : formatCOP(data.totalSavings)}
          sub="available + in loans"
          highlight="neutral"
        />
        <KpiCard
          label="Liquidity"
          value={privacyMode ? MASK : (data.liquidityRatio !== null ? `${data.liquidityRatio.toFixed(1)}%` : "—")}
          sub="available / total"
          highlight={liquidityWarn ? "bad" : "neutral"}
          warn={liquidityWarn}
        />
      </div>

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.accounts.map((a) => (
              <AccountCard key={a.id} account={a} masked={privacyMode} />
            ))}
          </div>
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
