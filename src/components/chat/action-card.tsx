"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useChat } from "./chat-provider";
import type { ProposalEvent } from "./chat-provider";
import type { EditableField, ProposalDescriptor } from "@/lib/agent/types";

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

const OTHER_OPTION_ID = "__other__";

// ─── Editable field select ────────────────────────────────────────────────────

type EditableFieldSelectProps = {
  proposalId: string;
  field: EditableField;
  onUpdated: (descriptor: ProposalDescriptor) => void;
};

function EditableFieldSelect({ proposalId, field, onUpdated }: EditableFieldSelectProps) {
  const [showOtherHint, setShowOtherHint] = useState(false);

  async function handleChange(value: string | null) {
    if (!value || value === field.selectedId) return;

    if (value === OTHER_OPTION_ID) {
      setShowOtherHint(true);
      return;
    }

    setShowOtherHint(false);

    try {
      const res = await fetch("/api/proposals/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, field: field.field, optionId: value }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        descriptor?: ProposalDescriptor;
        message?: string;
      };
      if (!data.ok || !data.descriptor) {
        throw new Error(data.message ?? "Could not update field");
      }
      onUpdated(data.descriptor);
    } catch (err) {
      console.error("[ActionCard] edit failed:", err);
      alert(`Could not apply: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-muted-foreground text-xs">{field.label}</label>
      <Select value={field.selectedId} onValueChange={handleChange}>
        <SelectTrigger className="h-7 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showOtherHint && (
        <p className="text-amber-600 dark:text-amber-400 text-xs">
          Escribe la categoría en el chat.
        </p>
      )}
    </div>
  );
}

// ─── Proposal fields display (enriched fields, or raw params fallback) ────────

function ProposalFieldsDisplay({ proposal }: { proposal: ProposalEvent }) {
  const hasFields = proposal.fields && proposal.fields.length > 0;
  const displayParams = hasFields
    ? null
    : Object.entries(proposal.params).filter(([k]) => k !== "vaultId" && k !== "id");

  if (hasFields) {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {proposal.fields.map((f, i) => {
          const isWarning = f.value.startsWith("⚠");
          return (
            <>
              <dt key={`dt-${i}`} className="text-muted-foreground text-xs pt-0.5">
                {f.label}
              </dt>
              <dd
                key={`dd-${i}`}
                className={cn(
                  "font-mono text-xs break-all",
                  isWarning ? "text-amber-600 dark:text-amber-400" : "text-foreground",
                )}
              >
                {f.value}
              </dd>
            </>
          );
        })}
      </dl>
    );
  }

  if (!displayParams || displayParams.length === 0) return null;

  return (
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
  );
}

// ─── Editable fields section ───────────────────────────────────────────────────

function EditableFieldsSection({
  proposal,
  onFieldUpdated,
}: {
  proposal: ProposalEvent;
  onFieldUpdated: (descriptor: ProposalDescriptor) => void;
}) {
  if (!proposal.editable || proposal.editable.length === 0) return null;

  return (
    <div className="space-y-2">
      {proposal.editable.map((field) => (
        <EditableFieldSelect
          key={field.field}
          proposalId={proposal.proposalId ?? ""}
          field={field}
          onUpdated={onFieldUpdated}
        />
      ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  proposal: ProposalEvent;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ActionCard({ proposal }: Props) {
  const router = useRouter();
  const { updateProposal, updateProposalDescriptor } = useChat();

  const isPending = proposal.approved === null;
  const isApproved = proposal.approved === true;

  async function handleApprove() {
    if (!proposal.proposalId) return;
    try {
      const res = await fetch("/api/proposals/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.proposalId, choiceId: "approve" }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!data.ok) throw new Error(data.message);
      updateProposal(proposal.id, true);
      router.refresh();
    } catch (err) {
      console.error("[ActionCard] approve failed:", err);
      alert(`Could not apply: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  function handleDismiss() {
    updateProposal(proposal.id, false);
  }

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

      <ProposalFieldsDisplay proposal={proposal} />

      {/* Editable fields (e.g. category) — only while pending */}
      {isPending && (
        <EditableFieldsSection
          proposal={proposal}
          onFieldUpdated={(descriptor) => updateProposalDescriptor(proposal.id, descriptor)}
        />
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
