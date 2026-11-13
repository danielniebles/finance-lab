"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckField,
  ColorPicker,
  DateField,
  Field,
  FieldGroupLabel,
  FormDialog,
  FormFooter,
  Money,
  MoneyInput,
} from "@/components/ds";
import { createWallet, deleteWallet, updateWallet, type WalletInput } from "@/lib/actions/wallets";
import { localISODate, parseISODate } from "@/lib/form-format";
import { TONE_CLASSES } from "@/lib/status";
import {
  openingBalanceFromParts,
  openingBalanceParts,
  walletDeleteBlocker,
  type WalletSettingsAccount,
  type WalletSettingsRow,
} from "@/lib/wallet-settings-display";

type FormState = {
  name: string;
  color: string | null;
  isSavings: boolean;
  includeInAvailable: boolean;
  makeDefault: boolean;
  balanceDigits: string;
  negative: boolean;
  openingDate: string; // YYYY-MM-DD
};

type SetField = <K extends keyof FormState>(k: K, v: FormState[K]) => void;

const NEW_WALLET: Omit<FormState, "openingDate"> = {
  name: "",
  color: null,
  isSavings: false,
  includeInAvailable: false,
  makeDefault: false,
  balanceDigits: "",
  negative: false,
};

function initialState(wallet: WalletSettingsRow | undefined): FormState {
  // Local "today": the UTC date is already tomorrow after 7pm in Bogotá.
  if (!wallet) return { ...NEW_WALLET, openingDate: localISODate(new Date()) };
  const balance = openingBalanceParts(wallet.openingBalance);
  return {
    name: wallet.name,
    color: wallet.color,
    isSavings: wallet.isSavings,
    includeInAvailable: wallet.includeInAvailable,
    makeDefault: wallet.isDefault,
    balanceDigits: balance.digits,
    negative: balance.negative,
    openingDate: localISODate(wallet.openingDate),
  };
}

/**
 * The opening balance/date go to the server only when they changed: the
 * stored epoch keeps its time of day, and re-saving the same date at noon
 * would drop that morning's movements from the balance.
 */
function toInput(form: FormState, wallet: WalletSettingsRow | undefined): WalletInput {
  const initial = initialState(wallet);
  const balance = openingBalanceFromParts(form.balanceDigits, form.negative);
  const balanceChanged = !wallet || balance !== openingBalanceFromParts(initial.balanceDigits, initial.negative);
  const dateChanged = !wallet || form.openingDate !== initial.openingDate;
  return {
    name: form.name,
    color: form.color,
    isSavings: form.isSavings,
    includeInAvailable: form.includeInAvailable,
    makeDefault: form.makeDefault && !wallet?.isDefault,
    openingBalance: balanceChanged ? balance : undefined,
    openingDate: dateChanged ? (parseISODate(form.openingDate) ?? undefined) : undefined,
  };
}

function errorHint(error: string | null): React.ReactNode {
  return error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined;
}

// ─── Field groups ─────────────────────────────────────────────────────────────

function CountsTowardFields({ form, setField, disabled }: { form: FormState; setField: SetField; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldGroupLabel>Counts toward</FieldGroupLabel>
      <CheckField
        id="wallet-savings"
        label="Savings"
        hint="Part of the savings figure on Savings & Loans."
        checked={form.isSavings}
        onChange={(v) => setField("isSavings", v)}
        disabled={disabled}
      />
      <CheckField
        id="wallet-available"
        label="Available balance"
        hint="Money you can use now. Only for savings wallets."
        checked={form.isSavings && form.includeInAvailable}
        onChange={(v) => setField("includeInAvailable", v)}
        disabled={disabled || !form.isSavings}
      />
    </div>
  );
}

function DefaultField({
  account,
  wallet,
  form,
  setField,
  disabled,
}: {
  account: WalletSettingsAccount;
  wallet: WalletSettingsRow | undefined;
  form: FormState;
  setField: SetField;
  disabled: boolean;
}) {
  const current = account.wallets.find((w) => w.isDefault);
  const isCurrent = !!wallet?.isDefault;
  const hint = isCurrent
    ? "Make another wallet the default to change it."
    : `Gets transactions that only name “${account.name}”.${current ? ` Now: ${current.name}.` : ""}`;
  return (
    <div className="flex flex-col gap-1">
      <FieldGroupLabel>In {account.name}</FieldGroupLabel>
      <CheckField
        id="wallet-default"
        label="Default wallet"
        hint={hint}
        checked={form.makeDefault}
        onChange={(v) => setField("makeDefault", v)}
        disabled={disabled || isCurrent}
      />
    </div>
  );
}

function OpeningBalanceFields({ form, setField, disabled }: { form: FormState; setField: SetField; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
      <FieldGroupLabel>Opening balance</FieldGroupLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" htmlFor="wallet-opening">
          <MoneyInput id="wallet-opening" value={form.balanceDigits} onValueChange={(v) => setField("balanceDigits", v)} disabled={disabled} />
        </Field>
        <Field label="As of" htmlFor="wallet-opening-date">
          <DateField id="wallet-opening-date" value={form.openingDate} onChange={(v) => setField("openingDate", v)} required disabled={disabled} />
        </Field>
      </div>
      <CheckField
        id="wallet-negative"
        label="Overdrawn"
        hint="The opening amount was negative."
        checked={form.negative}
        onChange={(v) => setField("negative", v)}
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">
        Balance = this amount + every movement on or after this date. Change it only to match the bank.
      </p>
    </div>
  );
}

// ─── Delete step ──────────────────────────────────────────────────────────────

/**
 * The delete confirmation's title, body and footer. It replaces the edit
 * form's content inside the SAME dialog: swapping in a second dialog
 * remounts it, and the click that opened it then lands "outside" and closes it.
 */
function useDeleteStep(wallet: WalletSettingsRow | undefined, walletCount: number, onClose: () => void, onBack: () => void) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!wallet) return null;
  const blocker = walletDeleteBlocker(wallet, walletCount);
  const id = wallet.id;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWallet(id);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return {
    title: blocker ? `${wallet.name} can't be deleted` : `Delete ${wallet.name}?`,
    body: <p className="text-sm text-muted-foreground">{blocker ?? "Nothing uses it, so no balance changes."}</p>,
    footer: (
      <FormFooter hint={errorHint(error)}>
        <Button type="button" variant="outline" onClick={onBack} autoFocus>
          {blocker ? "Back" : "Cancel"}
        </Button>
        {!blocker && (
          <Button type="button" variant="destructive" disabled={pending || !!error} onClick={handleDelete}>
            {pending ? "Deleting…" : "Delete wallet"}
          </Button>
        )}
      </FormFooter>
    ),
  };
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

type DialogProps = {
  account: WalletSettingsAccount;
  /** Omitted: a new wallet in `account`. */
  wallet?: WalletSettingsRow;
  open: boolean;
  onClose: () => void;
};

function EditFields({ account, wallet, form, setField, disabled }: { account: WalletSettingsAccount; wallet: WalletSettingsRow | undefined; form: FormState; setField: SetField; disabled: boolean }) {
  return (
    <>
      <Field label="Name" htmlFor="wallet-name">
        <Input
          id="wallet-name"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="e.g. Daily"
          required
          disabled={disabled}
        />
      </Field>
      <Field label="Colour" optional>
        <ColorPicker value={form.color} onChange={(c) => setField("color", c)} allowNone disabled={disabled} />
      </Field>
      <CountsTowardFields form={form} setField={setField} disabled={disabled} />
      <DefaultField account={account} wallet={wallet} form={form} setField={setField} disabled={disabled} />
      <OpeningBalanceFields form={form} setField={setField} disabled={disabled} />
    </>
  );
}

function EditFooter({ isEdit, error, pending, canSave, onDelete, onClose }: { isEdit: boolean; error: string | null; pending: boolean; canSave: boolean; onDelete: () => void; onClose: () => void }) {
  return (
    <FormFooter hint={errorHint(error)}>
      {isEdit && (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
          disabled={pending}
          onClick={onDelete}
        >
          Delete
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending || !canSave}>
        {pending ? "Saving…" : isEdit ? "Save changes" : "Add wallet"}
      </Button>
    </FormFooter>
  );
}

function WalletDialogInner({ account, wallet, open, onClose }: DialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(wallet));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const setField: SetField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const deleteStep = useDeleteStep(wallet, account.wallets.length, onClose, () => setConfirmingDelete(false));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    startTransition(async () => {
      const input = toInput(form, wallet);
      const result = wallet ? await updateWallet(wallet.id, input) : await createWallet(account.id, input);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  const step = confirmingDelete ? deleteStep : null;
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={step?.title ?? (wallet ? `Edit ${wallet.name}` : `New wallet in ${account.name}`)}
      description={
        !step && wallet ? (
          <>
            {account.name} · balance <Money value={wallet.balance} className="text-foreground" />
          </>
        ) : undefined
      }
      onSubmit={handleSubmit}
      footer={
        step?.footer ?? (
          <EditFooter
            isEdit={!!wallet}
            error={error}
            pending={pending}
            canSave={!!form.name.trim()}
            onDelete={() => setConfirmingDelete(true)}
            onClose={onClose}
          />
        )
      }
    >
      {step?.body ?? <EditFields account={account} wallet={wallet} form={form} setField={setField} disabled={pending} />}
    </FormDialog>
  );
}

/** Edit one wallet (`wallet`) or add one to `account`. Starts from the saved values on every open. */
export function WalletDialog(props: DialogProps) {
  const [session, setSession] = useState(0);
  const [lastOpen, setLastOpen] = useState(props.open);
  if (props.open !== lastOpen) {
    setLastOpen(props.open);
    if (props.open) setSession((n) => n + 1);
  }
  return <WalletDialogInner key={`${props.wallet?.id ?? "new"}-${session}`} {...props} />;
}
