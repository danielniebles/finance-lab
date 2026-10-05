"use client";

import { ArrowLeftRight, History, Pencil, PiggyBank, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Meter, Money, StatusChip } from "@/components/ds";
import { TONE_CLASSES, toneForVaultStatus } from "@/lib/status";
import { stillNeededThisMonth, type NextDue } from "@/lib/vault-display";
import { cn } from "@/lib/utils";
import type { VaultWithMetrics } from "@/lib/queries/vaults";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function goalLabel(vault: VaultWithMetrics): string {
  if (vault.goalType === "RECURRING") return "Sinking fund";
  if (vault.goalType === "OPEN_ENDED") return "Open goal";
  if (vault.status === "Met") return "Goal met";
  if (vault.status === "Overdue") return "Overdue";
  return vault.monthsLeft > 0 ? `Goal · ${vault.monthsLeft} mo left` : "Deadline passed";
}

function shortDate(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

// ─── Body variants ────────────────────────────────────────────────────────────

/** RECURRING: the set-aside for this month is the number that matters. */
function SetAsideBody({ vault }: { vault: VaultWithMetrics }) {
  const needed = stillNeededThisMonth(vault);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Set aside this month</span>
      <Money
        value={needed}
        tone={needed <= 0 ? "positive" : toneForVaultStatus(vault.status)}
        className="text-2xl font-semibold"
      />
    </div>
  );
}

/** Goals: balance toward the target, with a meter. */
function GoalBody({ vault }: { vault: VaultWithMetrics }) {
  const pct = vault.progressPct;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Money value={vault.balance} className="text-2xl font-semibold" />
        {vault.targetAmount !== null && (
          <span className="text-xs text-muted-foreground">
            of <Money value={vault.targetAmount} />
          </span>
        )}
      </div>
      {pct !== null && (
        <>
          <Meter
            label={`${vault.name} progress toward goal`}
            value={pct}
            max={100}
            tone={toneForVaultStatus(vault.status)}
          />
          <span className="text-xs text-muted-foreground">{Math.round(pct)}% of goal saved</span>
        </>
      )}
    </div>
  );
}

/** Footer line: balance or this month's need, plus the next bill it funds. */
function FactsRow({ vault, nextDue }: { vault: VaultWithMetrics; nextDue?: NextDue }) {
  const needed = stillNeededThisMonth(vault);
  const showNeeded = vault.goalType === "FIXED_DEADLINE" && needed > 0 && vault.status !== "Met";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
      {showNeeded ? (
        <span>
          Needed this month{" "}
          <Money value={needed} tone={toneForVaultStatus(vault.status)} className="font-semibold" />
        </span>
      ) : (
        <span>
          Balance <Money value={vault.balance} className="text-foreground" />
        </span>
      )}
      {nextDue && (
        <span className="truncate">
          Next: {nextDue.name} · {shortDate(nextDue.date)}
        </span>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  vault: VaultWithMetrics;
  nextDue?: NextDue;
  onContribute: () => void;
  onEdit: () => void;
  onHistory: () => void;
};

export function VaultTile({ vault, nextDue, onContribute, onEdit, onHistory }: Props) {
  const { name, kind, status, goalType } = vault;
  const mandatory = kind === "MANDATORY";
  const Icon = mandatory ? ShieldCheck : PiggyBank;
  const urgent = status === "Overdue" || (mandatory && stillNeededThisMonth(vault) > 0);

  return (
    <article
      aria-label={name}
      className={cn(
        "flex h-full flex-col gap-4 rounded-2xl border bg-card p-4",
        urgent ? "border-destructive/40" : "border-border/60",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              TONE_CLASSES[mandatory ? "danger" : "info"].soft,
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              {vault.color && (
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  // Vault color is user data (picked in the vault form), not a theme color.
                  style={{ backgroundColor: vault.color }}
                />
              )}
              <span className="truncate font-heading text-sm font-semibold">{name}</span>
            </span>
            <span className={cn("text-xs", mandatory ? "text-destructive" : "text-muted-foreground")}>
              {mandatory ? "Mandatory" : "Leisure"} · {goalLabel(vault)}
            </span>
          </span>
        </div>
        <StatusChip tone={toneForVaultStatus(status)}>{status}</StatusChip>
      </header>

      <div className="flex-1">{goalType === "RECURRING" ? <SetAsideBody vault={vault} /> : <GoalBody vault={vault} />}</div>

      <FactsRow vault={vault} nextDue={nextDue} />

      <div className="flex items-center gap-2">
        <Button className="h-9 flex-1" onClick={onContribute} aria-label={`Fund or withdraw from ${name}`}>
          <ArrowLeftRight className="size-4" aria-hidden />
          Fund
        </Button>
        <Button variant="outline" size="icon" className="size-9" aria-label={`View history for ${name}`} onClick={onHistory}>
          <History className="size-4" aria-hidden />
        </Button>
        <Button variant="outline" size="icon" className="size-9" aria-label={`Edit ${name}`} onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
        </Button>
      </div>
    </article>
  );
}
