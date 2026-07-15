"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VaultWithMetrics } from "@/lib/queries/vaults";
import type { VaultStatus } from "@/lib/vault-utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusClasses(status: VaultStatus): string {
  switch (status) {
    case "Met":
      return "text-success bg-success/10";
    case "On track":
      return "text-success/70 bg-success/10";
    case "Behind":
      return "text-warning bg-warning/10";
    case "Overdue":
      return "text-destructive bg-destructive/10";
    case "Open":
      return "text-muted-foreground bg-muted";
    case "Underfunded":
      return "text-warning bg-warning/10";
  }
}

function ringColor(status: VaultStatus): string {
  switch (status) {
    case "Met":
      return "oklch(0.762 0.157 164)";
    case "On track":
    case "Open":
      return "oklch(0.72 0.18 155)";
    case "Behind":
    case "Underfunded":
      return "oklch(0.8 0.15 80)";
    case "Overdue":
      return "oklch(0.6 0.22 25)";
  }
}

function requiredThisMonthColor(status: VaultStatus): string {
  switch (status) {
    case "Overdue":
      return "text-destructive";
    case "Behind":
      return "text-warning";
    default:
      return "text-foreground";
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  vault: VaultWithMetrics;
  onContribute: () => void;
  onWithdraw: () => void;
  onEdit: () => void;
  onHistory: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VaultTile({
  vault,
  onContribute,
  onWithdraw,
  onEdit,
  onHistory,
}: Props) {
  const {
    name,
    kind,
    goalType,
    status,
    balance,
    targetAmount,
    requiredThisMonth,
    monthsLeft,
    progressPct,
    color,
  } = vault;

  const circumference = 163.36; // 2 * Math.PI * 26
  const pct = progressPct ?? 0;
  const dashOffset = circumference * (1 - Math.min(pct, 100) / 100);

  const isMet = status === "Met";
  const isOverdue = status === "Overdue";
  const isOpen = goalType === "OPEN_ENDED";
  const isRecurring = goalType === "RECURRING";

  return (
    <article
      role="article"
      aria-label={name}
      className="h-full rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden flex flex-col"
    >
      {/* Header zone — color accent strip */}
      <div
        className="px-4 pt-4 pb-3 border-b-4"
        style={{ borderBottomColor: color ?? "transparent" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-heading text-sm font-semibold truncate text-foreground">
              {name}
            </span>
            {/* Kind chip */}
            <span
              className={cn(
                "self-start text-[10px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5",
                kind === "MANDATORY"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {kind === "MANDATORY" ? "Mandatory" : "Leisure"}
            </span>
          </div>
          {/* Status badge */}
          <span
            role="status"
            aria-label={`Vault status: ${status}`}
            className={cn(
              "shrink-0 text-[10px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5",
              statusClasses(status),
            )}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Body zone */}
      <div className="px-4 py-4 flex items-center gap-4 flex-1">
        {isRecurring ? (
          /* RECURRING: no ring, show set-aside + balance */
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div>
              <p className="font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Set-aside this month
              </p>
              <p
                className={cn(
                  "font-mono text-lg font-semibold tabular-nums",
                  status === "Underfunded" ? "text-warning" : "text-foreground",
                )}
                aria-label={`Set-aside this month: ${formatCOP(requiredThisMonth)}`}
              >
                {formatCOP(requiredThisMonth)}
              </p>
            </div>
            <div>
              <p className="font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Balance
              </p>
              <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
                {formatCOP(balance)}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Progress ring */}
            <div className="shrink-0">
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                role="img"
                aria-label={
                  progressPct !== null
                    ? `${progressPct.toFixed(0)}% saved toward goal`
                    : "Open-ended vault"
                }
              >
                {/* Track */}
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-foreground/10"
                  strokeLinecap="round"
                />
                {/* Fill */}
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke={ringColor(status)}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={String(circumference)}
                  strokeDashoffset={String(dashOffset)}
                  transform="rotate(-90 32 32)"
                />
                {/* Center label */}
                <text
                  x="32"
                  y="32"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono fill-foreground"
                  fontSize="11"
                  fontWeight="600"
                >
                  {progressPct !== null ? `${Math.round(pct)}%` : "—"}
                </text>
              </svg>
            </div>

            {/* Metric column */}
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div>
                <p className="font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Balance
                </p>
                <p className="font-mono text-lg font-semibold text-foreground tabular-nums">
                  {formatCOP(balance)}
                </p>
                {targetAmount !== null && (
                  <p className="font-mono text-xs text-muted-foreground tabular-nums">
                    of {formatCOP(targetAmount)}
                  </p>
                )}
              </div>

              {/* Required this month — FIXED_DEADLINE only */}
              {goalType === "FIXED_DEADLINE" && requiredThisMonth > 0 && !isMet && (
                <div>
                  <p className="font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Needed this month
                  </p>
                  <p
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      requiredThisMonthColor(status),
                    )}
                    aria-label={`Needed this month: ${formatCOP(requiredThisMonth)}`}
                  >
                    {formatCOP(requiredThisMonth)}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer zone */}
      <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        {/* Left: status indicator */}
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {isRecurring ? (
            "Sinking fund"
          ) : isMet ? (
            <span className="text-success">Goal met</span>
          ) : isOverdue ? (
            <span className="text-destructive">Overdue</span>
          ) : isOpen ? (
            "Open goal"
          ) : monthsLeft > 0 ? (
            `${monthsLeft} mo left`
          ) : (
            "Deadline passed"
          )}
        </p>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            aria-label={`View history for ${name}`}
            onClick={onHistory}
          >
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            aria-label={`Contribute to ${name}`}
            onClick={onContribute}
          >
            + Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            aria-label={`Withdraw from ${name}`}
            onClick={onWithdraw}
          >
            − Withdraw
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Edit ${name}`}
            onClick={onEdit}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}
