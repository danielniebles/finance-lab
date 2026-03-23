"use client";

import { useState, useTransition } from "react";
import {
  createAppCategory,
  updateAppCategory,
  deleteAppCategory,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
} from "@/lib/actions/categories";
import { BudgetType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Check, X, ChevronDown } from "lucide-react";
import { formatCOP } from "@/lib/format";

type BudgetItemData = {
  id: string;
  name: string;
  amount: number;
  budgetType: BudgetType;
};

type Category = {
  id: string;
  name: string;
  budgetItems: BudgetItemData[];
  _count: { mappings: number };
};

type EffectiveType = "FIXED" | "VARIABLE" | "MIXED";

function getEffectiveType(items: BudgetItemData[]): EffectiveType {
  if (items.length === 0) return "VARIABLE";
  const hasFixed = items.some((i) => i.budgetType === "FIXED");
  const hasVariable = items.some((i) => i.budgetType === "VARIABLE");
  if (hasFixed && hasVariable) return "MIXED";
  return hasFixed ? "FIXED" : "VARIABLE";
}

function TypeBadge({ type }: { type: EffectiveType | BudgetType }) {
  const map: Record<string, string> = {
    FIXED: "bg-blue-500/10 text-blue-400",
    VARIABLE: "bg-violet-500/10 text-violet-400",
    MIXED: "bg-amber-500/10 text-amber-400",
  };
  const label: Record<string, string> = {
    FIXED: "Fixed",
    VARIABLE: "Variable",
    MIXED: "Mixed",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[type]}`}
    >
      {label[type]}
    </span>
  );
}

function BudgetTypeSelect({
  value,
  onChange,
}: {
  value: BudgetType;
  onChange: (v: BudgetType) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as BudgetType)}>
      <SelectTrigger className="h-8 w-28">
        <span className="text-sm">{value === "FIXED" ? "Fixed" : "Variable"}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="FIXED">Fixed</SelectItem>
        <SelectItem value="VARIABLE">Variable</SelectItem>
      </SelectContent>
    </Select>
  );
}

function BudgetItemRow({
  item,
  onSaved,
}: {
  item: BudgetItemData;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [budgetType, setBudgetType] = useState<BudgetType>(item.budgetType);
  const [pending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateBudgetItem(item.id, {
        name: name.trim(),
        amount: parseFloat(amount),
        budgetType,
      });
      setEditing(false);
      onSaved?.();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete budget item "${item.name}"?`)) return;
    startTransition(async () => {
      await deleteBudgetItem(item.id);
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-2 py-2 pl-8 pr-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 w-32 text-xs"
          required
        />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-7 w-28 text-xs font-mono"
          min={0}
          required
        />
        <BudgetTypeSelect value={budgetType} onChange={setBudgetType} />
        <Button type="submit" size="icon" className="size-7" disabled={pending}>
          <Check className="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setEditing(false)}
        >
          <X className="size-3" />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 pl-8 pr-3 group hover:bg-muted/20">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground w-2">·</span>
        <span className="text-sm">{item.name}</span>
        <TypeBadge type={item.budgetType} />
        <span className="font-mono text-sm text-muted-foreground">
          {formatCOP(item.amount)}
        </span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={pending}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function AddBudgetItemRow({
  categoryId,
  onDone,
}: {
  categoryId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [budgetType, setBudgetType] = useState<BudgetType>("FIXED");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createBudgetItem(categoryId, {
        name: name.trim(),
        amount: parseFloat(amount),
        budgetType,
      });
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 py-2 pl-8 pr-3 border-t border-border/50">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Rent"
        className="h-7 w-32 text-xs"
        autoFocus
        required
      />
      <Input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="h-7 w-28 text-xs font-mono"
        min={0}
        required
      />
      <BudgetTypeSelect value={budgetType} onChange={setBudgetType} />
      <Button type="submit" size="icon" className="size-7" disabled={pending}>
        <Check className="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onDone}
      >
        <X className="size-3" />
      </Button>
    </form>
  );
}

function CategoryRow({ cat }: { cat: Category }) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(cat.name);
  const [addingItem, setAddingItem] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = cat.budgetItems.reduce((s, i) => s + i.amount, 0);
  const effectiveType = getEffectiveType(cat.budgetItems);

  function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateAppCategory(cat.id, { name: name.trim() });
      setEditingName(false);
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete "${cat.name}"? This will also remove its mappings and budget items.`
      )
    )
      return;
    startTransition(() => deleteAppCategory(cat.id));
  }

  return (
    <div className="border-b border-border last:border-0">
      {/* Category header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          {editingName ? (
            <form onSubmit={handleNameSave} className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 w-40 text-sm"
                autoFocus
                required
              />
              <Button type="submit" size="icon" className="size-7" disabled={pending}>
                <Check className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => { setName(cat.name); setEditingName(false); }}
              >
                <X className="size-3" />
              </Button>
            </form>
          ) : (
            <span className="font-medium">{cat.name}</span>
          )}

          <TypeBadge type={effectiveType} />

          <span className="font-mono text-sm text-muted-foreground">
            {formatCOP(total)} / mo
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
            onClick={() => setEditingName(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded: budget items */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/10">
          {cat.budgetItems.length === 0 && !addingItem && (
            <p className="py-2 pl-8 text-xs text-muted-foreground">
              No budget items yet.
            </p>
          )}
          {cat.budgetItems.map((item) => (
            <BudgetItemRow key={item.id} item={item} />
          ))}
          {addingItem ? (
            <AddBudgetItemRow
              categoryId={cat.id}
              onDone={() => setAddingItem(false)}
            />
          ) : (
            <div className="py-2 pl-8 pr-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs text-muted-foreground"
                onClick={() => setAddingItem(true)}
              >
                <Plus className="size-3" />
                Add item
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddCategoryRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createAppCategory({ name: name.trim() });
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4 border-t border-border">
      <div className="space-y-1">
        <Label className="text-xs">Category name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bills & Utilities"
          className="h-8 w-48"
          autoFocus
          required
        />
      </div>
      <div className="flex gap-1">
        <Button type="submit" size="icon" className="size-8" disabled={pending}>
          <Check className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onDone}>
          <X className="size-3.5" />
        </Button>
      </div>
    </form>
  );
}

export function CategoryList({ categories }: { categories: Category[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border divide-y-0 overflow-hidden">
        {categories.map((cat) => (
          <CategoryRow key={cat.id} cat={cat} />
        ))}

        {categories.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No categories yet. Add one below.
          </div>
        )}

        {adding && <AddCategoryRow onDone={() => setAdding(false)} />}
      </div>

      {!adding && (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add category
        </Button>
      )}
    </div>
  );
}
