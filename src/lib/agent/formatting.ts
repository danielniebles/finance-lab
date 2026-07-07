// Proposal display formatting — pure functions that turn raw tool params
// into human-readable titles and field lists for action cards.
// Split out of run-agent-turn.ts (see docs/backlog.md god-file item).

export function formatParamKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

export function formatParamValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (
    (key === "amount" || key === "targetAmount" || key === "estimatedAmount") &&
    typeof value === "number"
  ) {
    return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
  }
  if (key === "targetDate" || key === "date" || key === "nextDueDate") {
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

const fmt = (v: unknown): string =>
  typeof v === "number"
    ? `$${new Intl.NumberFormat("es-CO").format(Math.round(v))} COP`
    : String(v ?? "");

type TitleBuilder = (input: Record<string, unknown>) => string;

const TITLE_BUILDERS: Record<string, TitleBuilder> = {
  propose_create_vault: (i) => `Create vault: ${i.name ?? "?"}`,
  propose_update_vault: (i) => `Update vault ${i.vaultId}`,
  propose_vault_contribution: (i) =>
    i.sourceAccountId
      ? `Contribute ${fmt(i.amount)} to vault ${i.vaultId} from account ${i.sourceAccountId}`
      : `Contribute ${fmt(i.amount)} to vault ${i.vaultId}`,
  propose_vault_withdrawal: (i) =>
    i.sourceAccountId
      ? `Withdraw ${fmt(i.amount)} from vault ${i.vaultId} (returns to account ${i.sourceAccountId})`
      : `Withdraw ${fmt(i.amount)} from vault ${i.vaultId}`,
  propose_archive_vault: (i) => `Archive vault ${i.vaultId}`,
  propose_create_recurring_expense: (i) =>
    `Add recurring expense: ${i.name ?? "?"}, ${fmt(i.estimatedAmount)} every ${i.cadenceMonths}mo`,
  propose_pay_recurring: (i) =>
    `Pay recurring expense ${i.id}: ${fmt(i.amount)}${i.fromVaultId ? ` from vault ${i.fromVaultId}` : ""}`,
  propose_import_from_drive: (i) =>
    `Import from Drive: ${i.fileName ?? i.fileId ?? "latest file"}`,
  propose_create_installment: (i) =>
    `Create installment: ${i.description ?? "?"} — ${fmt(i.totalAmount)} × ${i.numInstallments}`,
  propose_mark_installment_paid: (i) => `Mark cuota paid: ${i.installmentName ?? "?"}`,
  propose_create_loan: (i) => `Create loan: ${fmt(i.amount)} → ${i.debtorName ?? "?"}`,
  propose_record_loan_payment: (i) =>
    `Record payment: ${fmt(i.amount)} from ${i.debtorName ?? "?"}`,
  propose_undo_last: (i) => `Undo: ${i.originalAction ?? "last action"}`,
  propose_add_transaction: (i) => `Add transaction: ${i.wallet ?? "?"} — ${fmt(i.amount)}`,
  propose_create_counterparty_rule: (i) =>
    `Create rule: ${i.matchType ?? "?"} "${i.matchValue ?? "?"}"`,
  propose_update_counterparty_rule: (i) => `Update rule ${i.ruleId}`,
  propose_delete_counterparty_rule: (i) => `Delete rule ${i.ruleId}`,
};

export function buildProposalTitle(name: string, input: Record<string, unknown>): string {
  return TITLE_BUILDERS[name]?.(input) ?? name;
}

export function buildProposalFields(
  input: Record<string, unknown>,
): { label: string; value: string }[] {
  // Skip internal ID fields from display
  const skipKeys = new Set([
    "vaultId", "id", "sourceAccountId", "fromVaultId", "fundingVaultId",
    "cardId", "debtorId", "accountId", "installmentId", "loanId",
    "targetProposalId", "createCard", "createDebtor", "createdId", "createdDebtorId",
    "appCategoryId", // shown via the editable mechanism, not a static field (ADR-031)
    "hadCounterpartyMatch", // internal bookkeeping for the learn-from-correction nudge (ADR-033)
    "ruleMatchType", "ruleMatchValue", // denormalized for the Telegram auto-record notification (ADR-033)
    "counterpartyAccount", "counterpartyMerchant", "counterpartySender", // extraction inputs, not user-facing card fields (ADR-033)
  ]);
  return Object.entries(input)
    .filter(([k]) => !skipKeys.has(k))
    .map(([k, v]) => ({ label: formatParamKey(k), value: formatParamValue(k, v) }));
}
