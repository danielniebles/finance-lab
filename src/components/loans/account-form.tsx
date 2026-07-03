"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createAccount, updateAccount } from "@/lib/actions/loans";
import { AccountType } from "@/generated/prisma";
import type { AccountWithBalance } from "@/lib/queries/loans";
import { PRESET_COLORS } from "@/lib/color-presets";

type FormState = { error?: string } | null;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BANK: "Bank",
  DIGITAL: "Digital Wallet",
  PENSION: "Pension (AFP)",
};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : editing ? "Save" : "Add account"}
    </Button>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          className="size-6 rounded-full border-2 transition-all"
          style={{
            backgroundColor: c.value,
            borderColor: value === c.value ? "white" : "transparent",
          }}
        />
      ))}
    </div>
  );
}

function AccountTypeSelect({
  value,
  onChange,
}: {
  value: AccountType;
  onChange: (v: AccountType) => void;
}) {
  function handleChange(v: string | null) {
    if (v) onChange(v as AccountType);
  }
  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-8">
        <span className="text-sm">
          {ACCOUNT_TYPE_LABELS[value] ?? value}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="BANK">Bank</SelectItem>
        <SelectItem value="DIGITAL">Digital Wallet</SelectItem>
        <SelectItem value="PENSION">Pension (AFP)</SelectItem>
      </SelectContent>
    </Select>
  );
}

function IncludeCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="include"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded"
      />
      <Label htmlFor="include" className="font-normal cursor-pointer">
        Include in Available balance
      </Label>
    </div>
  );
}

function InitialBalanceFields() {
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
      <div className="space-y-1.5">
        <Label>Initial balance (COP)</Label>
        <Input name="initialBalance" type="number" placeholder="0" />
      </div>
      <div className="space-y-1.5">
        <Label>As of date</Label>
        <Input
          name="initialDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </div>
  );
}

type AccountFormData = {
  name: string;
  accountType: AccountType;
  color: string;
  includeInAvailable: boolean;
};

async function saveAccount(
  editing: AccountWithBalance | null,
  base: AccountFormData,
  formData: FormData
): Promise<FormState> {
  try {
    if (editing) {
      await updateAccount(editing.id, base);
    } else {
      const balanceStr = formData.get("initialBalance") as string;
      const dateStr = formData.get("initialDate") as string;
      await createAccount({
        ...base,
        initialBalance: balanceStr ? parseFloat(balanceStr) : undefined,
        initialDate: dateStr ? new Date(dateStr + "T12:00:00") : undefined,
      });
    }
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

/** Inner form — keyed so it remounts fresh when editing target changes. */
function AccountFormInner({
  editing,
  onClose,
}: {
  editing: AccountWithBalance | null;
  onClose: () => void;
}) {
  const [accountType, setAccountType] = useState<AccountType>(
    (editing?.accountType as AccountType) ?? AccountType.BANK
  );
  const [color, setColor] = useState(editing?.color ?? "#EAB308");
  const [includeInAvailable, setIncludeInAvailable] = useState(
    editing?.includeInAvailable ?? true
  );

  const [state, action] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const name = (formData.get("name") as string).trim();
      const result = await saveAccount(editing, { name, accountType, color, includeInAvailable }, formData);
      if (!result) onClose();
      return result;
    },
    null
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          name="name"
          defaultValue={editing?.name ?? ""}
          placeholder="e.g. Bancolombia"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <AccountTypeSelect value={accountType} onChange={setAccountType} />
        </div>

        <div className="space-y-1.5">
          <Label>Color</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>

      <IncludeCheckbox checked={includeInAvailable} onChange={setIncludeInAvailable} />

      {!editing && <InitialBalanceFields />}

      {state?.error && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <SubmitButton editing={!!editing} />
      </DialogFooter>
    </form>
  );
}

export function AccountForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: AccountWithBalance | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "New savings account"}</DialogTitle>
        </DialogHeader>
        <AccountFormInner key={editing?.id ?? "new"} editing={editing} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
