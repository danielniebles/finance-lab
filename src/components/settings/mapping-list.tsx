"use client";

import { useTransition } from "react";
import { saveCategoryMapping, deleteCategoryMapping } from "@/lib/actions/categories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type MLCategory = {
  id: string;
  name: string;
  mapping: { appCategory: { id: string; name: string } } | null;
};

type AppCategory = { id: string; name: string };

export function MappingList({
  mlCategories,
  appCategories,
}: {
  mlCategories: MLCategory[];
  appCategories: AppCategory[];
}) {
  const [isPending, startTransition] = useTransition();

  const unmapped = mlCategories.filter((c) => !c.mapping);
  const mapped = mlCategories.filter((c) => c.mapping);

  return (
    <div className="space-y-4">
      {unmapped.length > 0 && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-1">
          <p className="px-3 py-2 text-xs font-medium text-yellow-800">
            {unmapped.length} unmapped — these are excluded from analysis
          </p>
          <div className="divide-y divide-yellow-200">
            {unmapped.map((cat) => (
              <MappingRow
                key={cat.id}
                cat={cat}
                appCategories={appCategories}
                isPending={isPending}
                onMap={(appCategoryId) =>
                  startTransition(() => saveCategoryMapping(cat.id, appCategoryId))
                }
                onUnmap={() => startTransition(() => deleteCategoryMapping(cat.id))}
              />
            ))}
          </div>
        </div>
      )}

      {mapped.length > 0 && (
        <div className="rounded-md border divide-y">
          {mapped.map((cat) => (
            <MappingRow
              key={cat.id}
              cat={cat}
              appCategories={appCategories}
              isPending={isPending}
              onMap={(appCategoryId) =>
                startTransition(() => saveCategoryMapping(cat.id, appCategoryId))
              }
              onUnmap={() => startTransition(() => deleteCategoryMapping(cat.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MappingRow({
  cat,
  appCategories,
  isPending,
  onMap,
  onUnmap,
}: {
  cat: MLCategory;
  appCategories: AppCategory[];
  isPending: boolean;
  onMap: (id: string) => void;
  onUnmap: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-sm font-medium w-48 shrink-0">{cat.name}</span>
      <span className="text-muted-foreground text-sm">→</span>
      <div className="flex items-center gap-2 flex-1">
        <Select
          value={cat.mapping?.appCategory.id ?? ""}
          onValueChange={(v) => v && onMap(v)}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 flex-1">
            <SelectValue placeholder="Select category…" />
          </SelectTrigger>
          <SelectContent>
            {appCategories.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cat.mapping && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={onUnmap}
            disabled={isPending}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
