"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormDialog, FormFooter, Money, MoneyInput, OptionSelect } from "@/components/ds";
import { payRecurringExpense } from "@/lib/actions/recurring";
import { amountToDigits } from "@/lib/form-format";
import { TONE_CLASSES } from "@/lib/status";
import type { RecurringExpenseRow } from "@/lib/queries/recurring";
import type { VaultWithMetrics } from "@/lib/queries/vaults";

/**
 * Record a payment of a recurring expense, optionally taking the money out
 * of its funding vault. Was a hand-built overlay (no focus trap, Escape or
 * phone layout); now the shared FormDialog.
 */
function usePayForm(expense: RecurringExpenseRow | null, onClose: () => void) {
  const [amount, setAmount] = useState("");
  const [fromVaultId, setFromVaultId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Prefill each time a different expense is opened.
  const id = expense ? expense.id : null;
  const [lastId, setLastId] = useState<string | null>(null);
  if (id !== lastId) {
    setLastId(id);
    if (expense) {
      setAmount(amountToDigits(expense.estimatedAmount));
      setFromVaultId(expense.fundingVaultId);
      setError(null);
    }
  }

  const value = parseFloat(amount);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense || !(value > 0)) return;
    setError(null);
    startTransition(async () => {
      try {
        await payRecurringExpense(expense.id, { amount: value, fromVaultId: fromVaultId ?? undefined });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  };
  return { amount, setAmount, fromVaultId, setFromVaultId, pending, error, canSubmit: value > 0, submit };
}

export function RecurringPayDialog({
  expense,
  recurringVaults,
  onClose,
}: {
  expense: RecurringExpenseRow | null;
  recurringVaults: VaultWithMetrics[];
  onClose: () => void;
}) {
  const { amount, setAmount, fromVaultId, setFromVaultId, pending, error, canSubmit, submit } = usePayForm(expense, onClose);
  const showVault = Boolean(expense?.fundingVaultId) && recurringVaults.length > 0;

  return (
    <FormDialog
      open={expense !== null}
      onOpenChange={(o) => !o && onClose()}
      title={`Pay ${expense?.name ?? ""}`}
      onSubmit={submit}
      footer={
        <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !canSubmit}>
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </FormFooter>
      }
    >
      <Field
        label="Amount"
        htmlFor="pay-amount"
        hint={<>Estimated <Money value={expense?.estimatedAmount ?? 0} className="text-foreground" /></>}
      >
        <MoneyInput id="pay-amount" size="lg" value={amount} onValueChange={setAmount} required disabled={pending} />
      </Field>
      {showVault && (
        <PayFromVault value={fromVaultId} onChange={setFromVaultId} vaults={recurringVaults} disabled={pending} />
      )}
    </FormDialog>
  );
}

function PayFromVault({
  value,
  onChange,
  vaults,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  vaults: VaultWithMetrics[];
  disabled: boolean;
}) {
  const vault = vaults.find((v) => v.id === value);
  return (
    <Field
      label="Take it from vault"
      optional
      hint={vault ? <>In the vault: <Money value={vault.balance} className="text-foreground" /></> : "None: the vault isn't touched."}
    >
      <OptionSelect
        ariaLabel="Take it from vault"
        value={value}
        onChange={onChange}
        noneLabel="None"
        options={vaults.map((v) => ({ value: v.id, label: v.name }))}
        disabled={disabled}
      />
    </Field>
  );
}
