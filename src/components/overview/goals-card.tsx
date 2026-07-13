import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import type { VaultObligations, VaultObligationItem } from "@/lib/queries/vaults";
import type { VaultStatus } from "@/lib/vault-utils";

// Overview-page-only presentation of vault obligations: grouped by
// Mandatory/Discretionary with a 3-way consolidated status, replacing the
// Vaults module's own top-banner treatment (vault-due-banner.tsx, which stays
// untouched — it's shared with the Vaults page). This is a regular card in
// the normal flow, not an alert banner (Overview redesign req 1 & 5).

type GoalStatus = "On track" | "Behind" | "Underfunded";

function consolidateStatus(status: VaultStatus): GoalStatus {
  switch (status) {
    case "Underfunded":
      return "Underfunded";
    case "Behind":
    case "Overdue":
      return "Behind";
    default: // Met, On track, Open
      return "On track";
  }
}

function statusClasses(status: GoalStatus, raw: VaultStatus): string {
  if (status === "On track") return "text-success bg-success/10";
  if (status === "Underfunded") return "text-warning bg-warning/10";
  // "Behind" — Overdue is the more urgent case, gets the destructive tone
  return raw === "Overdue" ? "text-destructive bg-destructive/10" : "text-warning bg-warning/10";
}

function GoalRow({ item }: { item: VaultObligationItem }) {
  const status = consolidateStatus(item.status);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.name}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          statusClasses(status, item.status)
        )}
      >
        {status}
      </span>
      <span
        className={cn(
          "shrink-0 w-24 text-right font-mono text-sm tabular-nums",
          item.stillNeeded > 0 ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {item.stillNeeded > 0 ? formatCOP(item.stillNeeded) : "—"}
      </span>
    </div>
  );
}

function GoalGroup({ title, items }: { title: string; items: VaultObligationItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </p>
      <div className="divide-y divide-border/40">
        {items.map((v) => (
          <GoalRow key={v.id} item={v} />
        ))}
      </div>
    </div>
  );
}

export function GoalsCard({ obligations }: { obligations: VaultObligations }) {
  if (obligations.vaults.length === 0) return null;

  const mandatory = obligations.vaults.filter((v) => v.kind === "MANDATORY");
  const discretionary = obligations.vaults.filter((v) => v.kind === "LEISURE");

  return (
    <Card className="border-border/60">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <CardTitle className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Goals
        </CardTitle>
        {obligations.totalStillNeeded > 0 && (
          <CardAction>
            <span className="text-xs text-muted-foreground">
              Still needed:{" "}
              <span className="font-mono font-semibold text-warning tabular-nums">
                {formatCOP(obligations.totalStillNeeded)}
              </span>
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-5 py-4 space-y-4">
        <GoalGroup title="Mandatory" items={mandatory} />
        <GoalGroup title="Discretionary" items={discretionary} />
      </CardContent>
    </Card>
  );
}
