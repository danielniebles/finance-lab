"use client";

import { useState, useTransition } from "react";
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
import { AccountType } from "@prisma/client";
import type { AccountWithBalance } from "@/lib/queries/loans";

const PRESET_COLORS = [
  { label: "Yellow",  value: "#EAB308" },
  { label: "Purple",  value: "#9333EA" },
  { label: "Orange",  value: "#F97316" },
  { label: "Lime",    value: "#A3E635" },
  { label: "Blue",    value: "#3B82F6" },
  { label: "Pink",    value: "#EC4899" },
  { label: "Teal",    value: "#14B8A6" },
  { label: "Red",     value: "#EF4444" },
];

type FormState = {
  name: string;
  accountType: AccountType;
  color: string;
  includeInAvailable: boolean;
  initialBalance: string;
  initialDate: string;
};

const EMPTY: FormState = {
  name: "",
  accountType: AccountType.BANK,
  color: "#EAB308",
  includeInAvailable: true,
  initialBalance: "",
  initialDate: new Date().toISOString().slice(0, 10),
};

function toForm(acc: AccountWithBalance): FormState {
  return {
    name: acc.name,
    accountType: acc.accountType as AccountType,
    color: acc.color ?? "#EAB308",
    includeInAvailable: acc.includeInAvailable,
    initialBalance: "",
    initialDate: new Date().toISOString().slice(0, 10),
  };
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
  const [form, setForm] = useState<FormState>(() => editing ? toForm(editing) : EMPTY);
  const [last, setLast] = useState(editing);
  const [pending, startTransition] = useTransition();

  if (editing !== last) {
    setLast(editing);
    setForm(editing ? toForm(editing) : EMPTY);
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editing) {
        await updateAccount(editing.id, {
          name: form.name.trim(),
          accountType: form.accountType,
          color: form.color,
          includeInAvailable: form.includeInAvailable,
        });
      } else {
        await createAccount({
          name: form.name.trim(),
          accountType: form.accountType,
          color: form.color,
          includeInAvailable: form.includeInAvailable,
          initialBalance: form.initialBalance ? parseFloat(form.initialBalance) : undefined,
          initialDate: form.initialDate ? new Date(form.initialDate + "T12:00:00") : undefined,
        });
      }
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "New savings account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Nu" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.accountType} onValueChange={(v) => v && set("accountType", v as AccountType)}>
                <SelectTrigger className="h-8">
                  <span className="text-sm">
                    {form.accountType === "BANK" ? "Bank" : form.accountType === "DIGITAL" ? "Digital Wallet" : "Pension (AFP)"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="DIGITAL">Digital Wallet</SelectItem>
                  <SelectItem value="PENSION">Pension (AFP)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => set("color", c.value)}
                    className="size-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c.value,
                      borderColor: form.color === c.value ? "white" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include"
              checked={form.includeInAvailable}
              onChange={(e) => set("includeInAvailable", e.target.checked)}
              className="size-4 rounded"
            />
            <Label htmlFor="include" className="font-normal cursor-pointer">
              Include in Available balance
            </Label>
          </div>

          {!editing && (
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label>Initial balance (COP)</Label>
                <Input
                  type="number"
                  value={form.initialBalance}
                  onChange={(e) => set("initialBalance", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>As of date</Label>
                <Input
                  type="date"
                  value={form.initialDate}
                  onChange={(e) => set("initialDate", e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{editing ? "Save" : "Add account"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
