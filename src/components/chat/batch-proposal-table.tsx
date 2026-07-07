"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BatchDescriptor, ProposalDescriptor } from "@/lib/agent/types";

// ─── Batch proposal table (ADR-034 — web rendering of a card-screenshot batch) ─
//
// Renders proposal.batch.items as an interactive table (checkbox + category
// select per row, a card-label select, a live total) and POSTs every edit
// immediately to /api/proposals/batch-edit, merging the returned descriptor
// back into ChatProvider state — mirrors EditableFieldSelect's request/
// response/state-merge pattern in action-card.tsx, adapted for the batch's
// many-items shape instead of a single editable field.

type BatchEditBody =
  | { proposalId: string; op: "toggle"; itemIdx: number }
  | { proposalId: string; op: "setCategory"; itemIdx: number; optionIdx: number }
  | { proposalId: string; op: "setCardLabel"; optionIdx: number };

type BatchEditResponse = { ok: boolean; descriptor?: ProposalDescriptor; message?: string };

async function postBatchEdit(body: BatchEditBody): Promise<BatchEditResponse> {
  const res = await fetch("/api/proposals/batch-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as BatchEditResponse;
}

function computeIncludedTotal(items: BatchDescriptor["items"]): number {
  return items
    .filter((item) => item.included)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
}

type BatchRowProps = {
  proposalId: string;
  item: BatchDescriptor["items"][number];
  idx: number;
  categoryOptions: BatchDescriptor["categoryOptions"];
  disabled: boolean;
  onUpdated: (descriptor: ProposalDescriptor) => void;
};

function BatchRow({ proposalId, item, idx, categoryOptions, disabled, onUpdated }: BatchRowProps) {
  async function handleToggle() {
    const data = await postBatchEdit({ proposalId, op: "toggle", itemIdx: idx });
    if (!data.ok || !data.descriptor) {
      console.error("[BatchRow] toggle failed:", data.message);
      alert(`Could not apply: ${data.message ?? "Unknown error"}`);
      return;
    }
    onUpdated(data.descriptor);
  }

  async function handleCategoryChange(value: string | null) {
    if (!value) return;
    const optionIdx = categoryOptions.findIndex((opt) => opt.id === value);
    if (optionIdx === -1 || value === item.appCategoryId) return;
    const data = await postBatchEdit({ proposalId, op: "setCategory", itemIdx: idx, optionIdx });
    if (!data.ok || !data.descriptor) {
      console.error("[BatchRow] setCategory failed:", data.message);
      alert(`Could not apply: ${data.message ?? "Unknown error"}`);
      return;
    }
    onUpdated(data.descriptor);
  }

  return (
    <TableRow className={cn("border-border/40", !item.included && "opacity-50")}>
      <TableCell>
        <Checkbox
          checked={item.included}
          onCheckedChange={handleToggle}
          disabled={disabled}
          aria-label={`Include ${item.vendor}`}
        />
      </TableCell>
      <TableCell className="text-sm">
        <span className={cn(item.scratchDetected && !item.included && "line-through")}>
          {item.vendor}
        </span>
        {item.scratchDetected && (
          <span className="ml-1 text-amber-600 dark:text-amber-400" title="Detected as scratched out">
            ⚠
          </span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-sm tabular-nums">
        {formatCOP(Math.abs(item.amount))}
      </TableCell>
      <TableCell>
        <Select value={item.appCategoryId} onValueChange={handleCategoryChange} disabled={disabled}>
          <SelectTrigger className="h-7 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}

type CardLabelSelectProps = {
  proposalId: string;
  batch: BatchDescriptor;
  disabled: boolean;
  onUpdated: (descriptor: ProposalDescriptor) => void;
};

function CardLabelSelect({ proposalId, batch, disabled, onUpdated }: CardLabelSelectProps) {
  async function handleChange(value: string | null) {
    if (!value) return;
    const optionIdx = batch.cardLabelOptions.findIndex((opt) => opt.id === value);
    if (optionIdx === -1) return;
    const data = await postBatchEdit({ proposalId, op: "setCardLabel", optionIdx });
    if (!data.ok || !data.descriptor) {
      console.error("[CardLabelSelect] setCardLabel failed:", data.message);
      alert(`Could not apply: ${data.message ?? "Unknown error"}`);
      return;
    }
    onUpdated(data.descriptor);
  }

  const selectedOption = batch.cardLabelOptions.find((opt) => opt.label === batch.cardLabel);

  return (
    <div className="flex items-center gap-2">
      <label className="text-muted-foreground text-xs shrink-0">Tarjeta</label>
      <Select value={selectedOption?.id} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className="h-7 w-full text-xs">
          <SelectValue placeholder={batch.cardLabel} />
        </SelectTrigger>
        <SelectContent>
          {batch.cardLabelOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type Props = {
  proposalId: string;
  batch: BatchDescriptor;
  disabled: boolean;
  onUpdated: (descriptor: ProposalDescriptor) => void;
};

export function BatchProposalTable({ proposalId, batch, disabled, onUpdated }: Props) {
  const includedCount = batch.items.filter((item) => item.included).length;
  const total = computeIncludedTotal(batch.items);

  return (
    <div className="space-y-2">
      <CardLabelSelect proposalId={proposalId} batch={batch} disabled={disabled} onUpdated={onUpdated} />

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Vendor
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Amount
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Category
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batch.items.map((item, idx) => (
              <BatchRow
                key={`${item.vendor}-${idx}`}
                proposalId={proposalId}
                item={item}
                idx={idx}
                categoryOptions={batch.categoryOptions}
                disabled={disabled}
                onUpdated={onUpdated}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Incluidas: <span className="font-medium text-foreground">{includedCount}</span> · Total:{" "}
        <span className="font-mono font-medium text-foreground">{formatCOP(total)}</span>
      </p>
    </div>
  );
}
