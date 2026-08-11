"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TagOption } from "@/lib/queries/tags";

/**
 * Free-text comma-separated input rather than a picker widget — matches the
 * "soft, no management screen required" nature of tags: typing a name that
 * doesn't exist yet just creates it on save (setTransactionTags'
 * connectOrCreate). The datalist only offers existing names as a typing aid,
 * it doesn't restrict input to them. Shared by AddTransactionRow (tag at
 * creation) and TransactionRow (tag on edit).
 */
export function TagsField({
  idPrefix,
  value,
  tags,
  onChange,
}: {
  idPrefix: string;
  value: string;
  tags: TagOption[];
  onChange: (v: string) => void;
}) {
  const datalistId = `${idPrefix}-tag-options`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-tags`}>
        Tags <span className="text-muted-foreground font-normal">(comma-separated, optional)</span>
      </Label>
      <Input
        id={`${idPrefix}-tags`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="uber, work-trip"
        list={datalistId}
      />
      <datalist id={datalistId}>
        {tags.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
    </div>
  );
}
