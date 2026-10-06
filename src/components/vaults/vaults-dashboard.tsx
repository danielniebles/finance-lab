"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextDueByVault } from "@/lib/vault-display";
import { VaultCarousel } from "./vault-carousel";
import { VaultsSummary } from "./vaults-summary";
import { VaultForm } from "./vault-form";
import { EntryForm } from "./entry-form";
import { VaultLedger } from "./vault-ledger";
import { RecurringList } from "./recurring-list";
import type { VaultWithMetrics, VaultObligations } from "@/lib/queries/vaults";
import type { getRecurringExpenses } from "@/lib/queries/recurring";
import type { AccountWithWallets } from "@/lib/queries/wallets";
import type { CategoryOption } from "@/lib/queries/expenses";

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
  startDay?: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VaultsDashboard({ vaults, obligations, recurringData, recurringVaults, month, year, walletAccounts, categories, startDay = 1 }: Props) {
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

  const nextDue = nextDueByVault(recurringData.items);

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

      {/* This month: one summary (replaces the due banner + stat band) */}
      {vaults.length > 0 && <VaultsSummary obligations={obligations} />}

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
        <VaultCarousel
          vaults={vaults}
          nextDue={nextDue}
          onContribute={(id) => openEntryDialog(id, "contribute")}
          onEdit={openEditDialog}
          onHistory={openLedger}
        />
      )}

      {/* Recurring expenses list */}
      <RecurringList
        recurringData={recurringData}
        recurringVaults={recurringVaults}
        formContext={{ categories, month, year, startDay }}
      />

      {/* Vault form dialog — key forces remount on every open so useState initializer
          always sees the current vault (base-nova doesn't call onOpenChange on external open) */}
      <VaultForm
        key={`${vaultFormOpen ? "open" : "closed"}-${editingVault?.id ?? "create"}`}
        open={vaultFormOpen}
        mode={vaultFormMode}
        vault={editingVault}
        onClose={() => setVaultFormOpen(false)}
        period={{ month, year, startDay }}
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
