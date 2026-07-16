"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VaultTile } from "./vault-tile";
import { VaultDueBanner } from "./vault-due-banner";
import { VaultForm } from "./vault-form";
import { EntryForm } from "./entry-form";
import { VaultLedger } from "./vault-ledger";
import { RecurringList } from "./recurring-list";
import type { VaultWithMetrics, VaultObligations } from "@/lib/queries/vaults";
import type { getRecurringExpenses } from "@/lib/queries/recurring";
import type { AccountWithWallets } from "@/lib/queries/wallets";
import type { CategoryOption } from "@/lib/queries/expenses";

// ─── StatInline — mirrors installments-dashboard pattern ─────────────────────

function StatInline({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "good" | "bad" | "neutral";
}) {
  const valueColor =
    highlight === "good"
      ? "text-success"
      : highlight === "bad"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("font-mono text-base sm:text-xl font-semibold", valueColor)}>
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type EntryState = {
  open: boolean;
  direction: "contribute" | "withdraw";
  vaultId: string;
  vaultName: string;
  currentBalance: number;
};

type LedgerState = {
  open: boolean;
  vault: VaultWithMetrics | null;
};

type Props = {
  vaults: VaultWithMetrics[];
  obligations: VaultObligations;
  recurringData: Awaited<ReturnType<typeof getRecurringExpenses>>;
  recurringVaults: VaultWithMetrics[];
  month: number;
  year: number;
  walletAccounts: AccountWithWallets[];
  categories: CategoryOption[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VaultsDashboard({ vaults, obligations, recurringData, recurringVaults, walletAccounts, categories }: Props) {
  // Vault form dialog
  const [vaultFormOpen, setVaultFormOpen] = useState(false);
  const [vaultFormMode, setVaultFormMode] = useState<"create" | "edit">("create");
  const [editingVault, setEditingVault] = useState<VaultWithMetrics | null>(null);

  // Entry form dialog
  const [entryState, setEntryState] = useState<EntryState>({
    open: false,
    direction: "contribute",
    vaultId: "",
    vaultName: "",
    currentBalance: 0,
  });

  // Ledger sheet
  const [ledgerState, setLedgerState] = useState<LedgerState>({
    open: false,
    vault: null,
  });

  function openAddDialog() {
    setVaultFormMode("create");
    setEditingVault(null);
    setVaultFormOpen(true);
  }

  function openEditDialog(vaultId: string) {
    const vault = vaults.find((v) => v.id === vaultId);
    if (!vault) return;
    setVaultFormMode("edit");
    setEditingVault(vault);
    setVaultFormOpen(true);
  }

  function openEntryDialog(
    vaultId: string,
    direction: "contribute" | "withdraw",
  ) {
    const vault = vaults.find((v) => v.id === vaultId);
    if (!vault) return;
    setEntryState({
      open: true,
      direction,
      vaultId,
      vaultName: vault.name,
      currentBalance: vault.balance,
    });
  }

  function openLedger(vaultId: string) {
    const vault = vaults.find((v) => v.id === vaultId);
    if (!vault) return;
    setLedgerState({ open: true, vault });
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Vaults</h1>
          <p className="text-sm text-muted-foreground">
            Goal-based savings pockets
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openAddDialog}>
          <Plus className="size-4 mr-1.5" aria-hidden="true" />
          New vault
        </Button>
      </div>

      {/* Due banner */}
      <VaultDueBanner obligations={obligations} />

      {/* Summary band */}
      {vaults.length > 0 && (
        <section
          aria-labelledby="vaults-summary-heading"
          className="rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden"
        >
          <h2 id="vaults-summary-heading" className="sr-only">
            Vault summary
          </h2>
          <div className="grid grid-cols-1 divide-y divide-border bg-muted/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3 sm:px-6 sm:py-4">
              <StatInline
                label="Total required"
                value={formatCOP(obligations.totalRequired)}
                sub="this month"
              />
            </div>
            <div className="px-4 py-3 sm:px-6 sm:py-4">
              <StatInline
                label="Still needed"
                value={formatCOP(obligations.totalStillNeeded)}
                highlight={obligations.totalStillNeeded > 0 ? "bad" : "good"}
              />
            </div>
            <div className="px-4 py-3 sm:px-6 sm:py-4">
              <StatInline
                label="Mandatory gap"
                value={formatCOP(obligations.mandatoryStillNeeded)}
                highlight={
                  obligations.mandatoryStillNeeded > 0 ? "bad" : "good"
                }
              />
            </div>
          </div>
        </section>
      )}

      {/* Vault grid / empty state */}
      {vaults.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-sm">No vaults yet.</p>
          <p className="text-xs mt-1">
            Add your first savings vault to start tracking goals.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={openAddDialog}
          >
            <Plus className="size-4 mr-1.5" aria-hidden="true" />
            New vault
          </Button>
        </div>
      ) : (
        <section aria-label="Vault tiles">
          {/* Mobile: carousel — a single stacked column of full tiles is a
              lot of scrolling; swipe through them instead. */}
          <Carousel opts={{ align: "start" }} className="sm:hidden">
            <CarouselContent>
              {vaults.map((v) => (
                // py-1: the tile's ring-1 border needs room to render —
                // horizontal carousels get pl-4 from CarouselItem by default
                // but no vertical padding, so the viewport's overflow-hidden
                // otherwise clips the ring flush at the top/bottom edge.
                <CarouselItem key={v.id} className="basis-[85%] py-1">
                  <VaultTile
                    vault={v}
                    onContribute={() => openEntryDialog(v.id, "contribute")}
                    onEdit={() => openEditDialog(v.id)}
                    onHistory={() => openLedger(v.id)}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vaults.map((v) => (
              <VaultTile
                key={v.id}
                vault={v}
                onContribute={() => openEntryDialog(v.id, "contribute")}
                onEdit={() => openEditDialog(v.id)}
                onHistory={() => openLedger(v.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recurring expenses list */}
      <RecurringList recurringData={recurringData} recurringVaults={recurringVaults} />

      {/* Vault form dialog — key forces remount on every open so useState initializer
          always sees the current vault (base-nova doesn't call onOpenChange on external open) */}
      <VaultForm
        key={`${vaultFormOpen ? "open" : "closed"}-${editingVault?.id ?? "create"}`}
        open={vaultFormOpen}
        mode={vaultFormMode}
        vault={editingVault}
        onClose={() => setVaultFormOpen(false)}
      />

      {/* Entry form dialog */}
      <EntryForm
        open={entryState.open}
        direction={entryState.direction}
        vaultId={entryState.vaultId}
        vaultName={entryState.vaultName}
        currentBalance={entryState.currentBalance}
        onClose={() =>
          setEntryState((prev) => ({ ...prev, open: false }))
        }
        walletAccounts={walletAccounts}
        categories={categories}
      />

      {/* Ledger sheet */}
      {ledgerState.vault && (
        <VaultLedger
          open={ledgerState.open}
          onOpenChange={(open) =>
            setLedgerState((prev) => ({ ...prev, open }))
          }
          vaultName={ledgerState.vault.name}
          balance={ledgerState.vault.balance}
          entries={ledgerState.vault.entries}
          onContribute={() => {
            setLedgerState((prev) => ({ ...prev, open: false }));
            if (ledgerState.vault) openEntryDialog(ledgerState.vault.id, "contribute");
          }}
          onWithdraw={() => {
            setLedgerState((prev) => ({ ...prev, open: false }));
            if (ledgerState.vault) openEntryDialog(ledgerState.vault.id, "withdraw");
          }}
        />
      )}
    </div>
  );
}
