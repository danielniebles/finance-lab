"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createVault,
  updateVault,
  addVaultEntry,
  archiveVault,
} from "@/lib/actions/vaults";
import { createRecurringExpense, payRecurringExpense } from "@/lib/actions/recurring";
import { useChat } from "./chat-provider";
import type { ProposalEvent } from "./chat-provider";
import type { VaultKind, VaultGoalType } from "@/generated/prisma";

// ─── Action map ───────────────────────────────────────────────────────────────

async function executeProposal(
  action: string,
  params: Record<string, unknown>,
): Promise<void> {
  switch (action) {
    case "propose_create_vault": {
      await createVault({
        name: params.name as string,
        kind: (params.kind as VaultKind | undefined) ?? "LEISURE",
        goalType: params.goalType as VaultGoalType,
        targetAmount: params.targetAmount != null ? Number(params.targetAmount) : null,
        targetDate:
          params.targetDate != null
            ? new Date(params.targetDate as string)
            : null,
      });
      break;
    }
    case "propose_update_vault": {
      const { vaultId, ...fields } = params;
      await updateVault(vaultId as string, {
        name: fields.name as string | undefined,
        kind: fields.kind as VaultKind | undefined,
        goalType: fields.goalType as VaultGoalType | undefined,
        targetAmount:
          "targetAmount" in fields
            ? fields.targetAmount != null
              ? Number(fields.targetAmount)
              : null
            : undefined,
        targetDate:
          "targetDate" in fields
            ? fields.targetDate != null
              ? new Date(fields.targetDate as string)
              : null
            : undefined,
        color: fields.color as string | undefined,
        notes: fields.notes as string | undefined,
      });
      break;
    }
    case "propose_vault_contribution": {
      await addVaultEntry(
        params.vaultId as string,
        Number(params.amount),
        params.date != null ? new Date(params.date as string) : undefined,
        params.notes as string | undefined,
      );
      break;
    }
    case "propose_vault_withdrawal": {
      await addVaultEntry(
        params.vaultId as string,
        -Number(params.amount),
        params.date != null ? new Date(params.date as string) : undefined,
        params.notes as string | undefined,
      );
      break;
    }
    case "propose_archive_vault": {
      await archiveVault(params.vaultId as string);
      break;
    }
    case "propose_create_recurring_expense": {
      await createRecurringExpense({
        name: params.name as string,
        estimatedAmount: Number(params.estimatedAmount),
        cadenceMonths: Number(params.cadenceMonths),
        nextDueDate: new Date(params.nextDueDate as string),
        category: params.category as string | undefined ?? null,
        fundingVaultId: params.fundingVaultId as string | undefined ?? null,
      });
      break;
    }
    case "propose_pay_recurring": {
      await payRecurringExpense(params.id as string, {
        amount: Number(params.amount),
        fromVaultId: params.fromVaultId as string | undefined,
      });
      break;
    }
    default:
      throw new Error(`No handler for action: ${action}`);
  }
}

// ─── Param display helpers ────────────────────────────────────────────────────

function formatParamKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatParamValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (
    (key === "amount" || key === "targetAmount") &&
    typeof value === "number"
  ) {
    return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
  }
  if (key === "targetDate" || key === "date") {
    try {
      return new Date(value as string).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  proposal: ProposalEvent;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ActionCard({ proposal }: Props) {
  const router = useRouter();
  const { updateProposal } = useChat();

  const isPending = proposal.approved === null;
  const isApproved = proposal.approved === true;

  async function handleApprove() {
    try {
      await executeProposal(proposal.action, proposal.params);
      updateProposal(proposal.id, true);
      router.refresh();
    } catch (err) {
      console.error("[ActionCard] approve failed:", err);
      // Surface error without crashing — keep the card in pending state
      alert(
        `Could not apply: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  function handleDismiss() {
    updateProposal(proposal.id, false);
  }

  // Params to display (skip internal IDs)
  const displayParams = Object.entries(proposal.params).filter(
    ([k]) => k !== "vaultId" && k !== "id",
  );

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 space-y-3 text-sm transition-colors",
        isPending
          ? "bg-muted/60 border-border"
          : isApproved
          ? "bg-success/5 border-success/30"
          : "bg-muted/30 border-border/50 opacity-60",
      )}
    >
      {/* Label */}
      <p className="font-heading font-semibold text-foreground leading-snug">
        {proposal.label}
      </p>

      {/* Params table */}
      {displayParams.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {displayParams.map(([k, v]) => (
            <>
              <dt key={`dt-${k}`} className="text-muted-foreground text-xs pt-0.5">
                {formatParamKey(k)}
              </dt>
              <dd key={`dd-${k}`} className="font-mono text-xs text-foreground break-all">
                {formatParamValue(k, v)}
              </dd>
            </>
          ))}
        </dl>
      )}

      {/* Action state */}
      {isPending ? (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs" onClick={handleApprove}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={handleDismiss}
          >
            Dismiss
          </Button>
        </div>
      ) : isApproved ? (
        <div className="flex items-center gap-1.5 text-success text-xs font-medium pt-1">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Approved
        </div>
      ) : (
        // dismissed
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs pt-1">
          <XCircle className="size-3.5" aria-hidden="true" />
          Dismissed
        </div>
      )}
    </div>
  );
}
