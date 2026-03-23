"use client";

import { useState, useTransition } from "react";
import { createAppCategory, updateAppCategory, deleteAppCategory } from "@/lib/actions/categories";
import { BudgetType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { formatCOP } from "@/lib/format";

type Category = {
  id: string;
  name: string;
  budgetType: BudgetType;
  monthlyBudget: number;
  _count: { mappings: number };
};

export function CategoryList({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="rounded-md border divide-y">
        {categories.map((cat) =>
          editing === cat.id ? (
            <EditRow
              key={cat.id}
              initial={cat}
              onSave={(data) => {
                startTransition(async () => {
                  await updateAppCategory(cat.id, data);
                  setEditing(null);
                });
              }}
              onCancel={() => setEditing(null)}
              isPending={isPending}
            />
          ) : (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-medium">{cat.name}</span>
                <Badge variant="outline" className="text-xs">
                  {cat.budgetType}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatCOP(cat.monthlyBudget)} / month
                </span>
                {cat._count.mappings > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {cat._count.mappings} mapping(s)
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditing(cat.id)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Delete "${cat.name}"? This will also remove its mappings.`)) {
                      startTransition(() => deleteAppCategory(cat.id));
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          )
        )}

        {categories.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No categories yet. Add one below.
          </div>
        )}
      </div>

      {adding ? (
        <div className="rounded-md border p-4">
          <EditRow
            onSave={(data) => {
              startTransition(async () => {
                await createAppCategory(data as { name: string; budgetType: BudgetType; monthlyBudget: number });
                setAdding(false);
              });
            }}
            onCancel={() => setAdding(false)}
            isPending={isPending}
          />
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add category
        </Button>
      )}
    </div>
  );
}

function EditRow({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: { name: string; budgetType: BudgetType; monthlyBudget: number };
  onSave: (data: { name: string; budgetType: BudgetType; monthlyBudget: number }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [budgetType, setBudgetType] = useState<BudgetType>(initial?.budgetType ?? "FIXED");
  const [budget, setBudget] = useState(String(initial?.monthlyBudget ?? ""));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name: name.trim(), budgetType, monthlyBudget: parseFloat(budget) });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
      <div className="space-y-1">
        <Label className="text-xs">Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Services"
          className="h-8 w-40"
          required
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Type</Label>
        <Select value={budgetType} onValueChange={(v) => setBudgetType(v as BudgetType)}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FIXED">Fixed</SelectItem>
            <SelectItem value="VARIABLE">Variable</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Monthly budget (COP)</Label>
        <Input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="500000"
          className="h-8 w-36"
          required
          min={0}
        />
      </div>
      <div className="flex gap-1">
        <Button type="submit" size="icon" className="size-8" disabled={isPending}>
          <Check className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onCancel}>
          <X className="size-3.5" />
        </Button>
      </div>
    </form>
  );
}
