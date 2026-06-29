"use client";

import { AlertTriangle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChat } from "@/components/chat/chat-provider";
import type { VaultObligations } from "@/lib/queries/vaults";
import type { VaultStatus } from "@/lib/vault-utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClasses(status: VaultStatus): string {
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

function stillNeededColor(status: VaultStatus): string {
  switch (status) {
    case "Overdue":
      return "text-destructive";
    case "Behind":
    case "Underfunded":
      return "text-warning";
    default:
      return "text-foreground";
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  obligations: VaultObligations;
  month: number;
  year: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VaultDueBanner({ obligations, month, year }: Props) {
  const { openChat } = useChat();

  if (obligations.totalStillNeeded === 0) return null;

  const urgentVaults = obligations.vaults.filter(
    (v) => v.stillNeeded > 0 && (v.status === "Behind" || v.status === "Overdue" || v.status === "Underfunded"),
  );

  return (
    <aside
      role="complementary"
      aria-label="Savings obligations this month"
      className="rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden"
    >
      {/* Header strip */}
      <div className="px-5 py-3 bg-warning/5 border-b border-warning/20 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-warning shrink-0" aria-hidden="true" />
          <p className="font-heading text-sm font-semibold text-foreground">Save this month</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {obligations.mandatoryStillNeeded > 0 && (
            <span className="text-xs text-muted-foreground">
              Mandatory:{" "}
              <span className="font-mono font-semibold text-destructive tabular-nums">
                {formatCOP(obligations.mandatoryStillNeeded)}
              </span>
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Total:{" "}
            <span className="font-mono font-semibold text-warning tabular-nums">
              {formatCOP(obligations.totalStillNeeded)}
            </span>
          </span>
        </div>
      </div>

      {/* Per-vault rows */}
      {urgentVaults.length > 0 && (
        <div className="divide-y divide-border/50">
          {urgentVaults.map((v) => (
            <div key={v.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
              {/* Kind chip */}
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5 shrink-0",
                  v.kind === "MANDATORY"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {v.kind === "MANDATORY" ? "Mandatory" : "Leisure"}
              </span>

              {/* Name */}
              <span className="flex-1 text-sm text-foreground truncate min-w-0">
                {v.name}
              </span>

              {/* Status badge */}
              <span
                role="status"
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5 shrink-0",
                  statusBadgeClasses(v.status),
                )}
              >
                {v.status}
              </span>

              {/* Still needed */}
              <span
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums shrink-0",
                  stillNeededColor(v.status),
                )}
              >
                {formatCOP(v.stillNeeded)}
              </span>

              {/* Ask agent button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs shrink-0 gap-1.5 h-7"
                aria-label={`Ask agent about ${v.name}`}
                onClick={() =>
                  openChat({
                    module: "vaults",
                    entityId: v.id,
                    focus: { month, year },
                  })
                }
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                Ask agent
              </Button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
