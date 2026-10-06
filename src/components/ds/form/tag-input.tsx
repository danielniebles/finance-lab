"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { joinTagDraft, splitTagDraft, tagSuggestions } from "@/lib/tag-utils";
import { cn } from "@/lib/utils";

/**
 * Tags as chips. Type a name and press Enter or comma to add it; Backspace
 * on an empty box removes the last one. Names that already exist are
 * suggested while typing; new names are created on save, as before.
 *
 * The value is the same comma-separated string the forms already store
 * (see splitTagDraft), so callers and server actions don't change.
 */
export function TagInput({
  id,
  value,
  onChange,
  existing,
  placeholder = "Add tag…",
}: {
  id?: string;
  value: string;
  onChange: (raw: string) => void;
  existing: string[];
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { tags, draft } = splitTagDraft(value);
  const suggestions = tagSuggestions(existing, tags, draft);

  const add = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n || tags.includes(n)) return onChange(joinTagDraft(tags, ""));
    onChange(joinTagDraft([...tags, n], ""));
  };
  const remove = (name: string) => onChange(joinTagDraft(tags.filter((t) => t !== name), draft));

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      e.preventDefault();
      remove(tags[tags.length - 1]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors dark:bg-input/30",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        )}
      >
        {tags.map((t) => (
          <span key={t} className="inline-flex h-6 items-center gap-1 rounded-full bg-muted pr-1 pl-2.5 text-xs">
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`Remove tag ${t}`}
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(e) => onChange(joinTagDraft(tags, e.target.value.replace(/,+$/, "")))}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={tags.length === 0 ? placeholder : ""}
          autoComplete="off"
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              // mousedown, not click: the input's blur would add the half-typed
              // draft first.
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
              className="h-7 rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
