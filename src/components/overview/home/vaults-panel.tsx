import { PiggyBank, ShieldCheck } from "lucide-react";
import { ListRow, Money, SectionHeader, StatusChip } from "@/components/ds";
import type { VaultObligations, VaultObligationItem } from "@/lib/queries/vaults";
import { toneForVaultStatus } from "@/lib/status";
import { Panel } from "./panel";

// Mandatory first, then by how much is still needed.
export function sortVaults(items: VaultObligationItem[]): VaultObligationItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.kind === "MANDATORY") - Number(a.kind === "MANDATORY") || b.stillNeeded - a.stillNeeded,
  );
}

function VaultRow({ item }: { item: VaultObligationItem }) {
  const mandatory = item.kind === "MANDATORY";
  return (
    <ListRow
      href="/vaults"
      icon={mandatory ? ShieldCheck : PiggyBank}
      iconTone={mandatory ? "danger" : "info"}
      title={item.name}
      subtitle={mandatory ? "Mandatory" : "Leisure"}
      trailing={
        // Phones: chip stacked over the amount so the vault name keeps room.
        <span className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <StatusChip tone={toneForVaultStatus(item.status)}>{item.status}</StatusChip>
          <span className="text-right text-sm sm:min-w-24">
            {item.stillNeeded > 0 ? <Money value={item.stillNeeded} /> : <span className="text-muted-foreground">—</span>}
          </span>
        </span>
      }
    />
  );
}

export function VaultsPanel({ obligations }: { obligations: VaultObligations }) {
  return (
    <Panel className="flex flex-col gap-3">
      <SectionHeader
        title="Vaults"
        href="/vaults"
        linkLabel="Fund vaults"
        trailing={
          obligations.totalStillNeeded > 0 ? (
            <span className="text-xs text-muted-foreground">
              Still needed <Money value={obligations.totalStillNeeded} tone="caution" className="font-semibold" />
            </span>
          ) : undefined
        }
      />
      {obligations.vaults.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No vaults need money this month.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {sortVaults(obligations.vaults).map((v) => (
            <VaultRow key={v.id} item={v} />
          ))}
        </div>
      )}
    </Panel>
  );
}
