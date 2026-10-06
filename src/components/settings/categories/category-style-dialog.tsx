"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormDialog, FormFooter } from "@/components/ds";
import { updateAppCategoryStyle } from "@/lib/actions/categories";
import {
  ICON_REGISTRY,
  CATEGORY_ICON_KEYS,
  CATEGORY_COLOR_KEYS,
  CATEGORY_SOLID_SWATCH,
  resolveEffectiveCategoryStyle,
  getAutoCategoryKeys,
  categoryPaletteClasses,
  categoryIconDisplayName,
  categoryColorDisplayName,
  type CategoryPalette,
  type CategoryColorKey,
} from "@/lib/category-style";
import { TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { SettingsCategory } from "./types";

function StateChip({ custom }: { custom: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        custom ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {custom ? "Custom" : "Auto"}
    </span>
  );
}

function CategoryStylePreview({ preview, name }: { preview: CategoryPalette; name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", preview.iconWrap)}>
        <preview.icon className="size-5" />
      </span>
      <span className={cn("inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium", preview.badge)}>
        {name}
      </span>
    </div>
  );
}

function SwatchSectionHeader({ label, custom, onReset }: { label: string; custom: boolean; onReset: () => void }) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      <span className="text-sm font-medium">{label}</span>
      <StateChip custom={custom} />
      {custom && (
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 text-xs text-muted-foreground" onClick={onReset}>
          Reset to auto
        </Button>
      )}
    </div>
  );
}

function IconSwatchGrid({
  effectiveKey,
  isCustom,
  swatchIconWrap,
  onSelect,
}: {
  effectiveKey: string | null;
  isCustom: boolean;
  swatchIconWrap: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
      {CATEGORY_ICON_KEYS.map((key) => {
        const Icon = ICON_REGISTRY[key];
        const isSelected = key === effectiveKey;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${categoryIconDisplayName(key)} icon`}
            onClick={() => onSelect(key)}
            className={cn(
              "flex size-10 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
              swatchIconWrap,
              isSelected && (isCustom ? "ring-2 ring-primary" : "ring-1 ring-border"),
            )}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
    </div>
  );
}

function ColorSwatchGrid({
  effectiveKey,
  isCustom,
  onSelect,
}: {
  effectiveKey: CategoryColorKey | null;
  isCustom: boolean;
  onSelect: (key: CategoryColorKey) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
      {CATEGORY_COLOR_KEYS.map((key) => {
        const isSelected = key === effectiveKey;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${categoryColorDisplayName(key)} color`}
            onClick={() => onSelect(key)}
            className={cn(
              "size-8 rounded-full transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
              CATEGORY_SOLID_SWATCH[key],
              isSelected && (isCustom ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "ring-1 ring-border"),
            )}
          />
        );
      })}
    </div>
  );
}

/**
 * Icon and colour for a category. Each is "Auto" (derived from the name)
 * until picked; "Reset to auto" goes back. Drafts reset on every open.
 */
export function CategoryStyleDialog({ cat, open, onClose }: { cat: SettingsCategory; open: boolean; onClose: () => void }) {
  const [draftIcon, setDraftIcon] = useState<string | null>(cat.icon);
  // cat.color is validated server-side against the closed CategoryColorKey set.
  const [draftColor, setDraftColor] = useState<CategoryColorKey | null>(cat.color as CategoryColorKey | null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDraftIcon(cat.icon);
      setDraftColor(cat.color as CategoryColorKey | null);
      setError(null);
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateAppCategoryStyle(cat.id, { icon: draftIcon, color: draftColor });
        onClose();
      } catch {
        setError("Couldn't save the icon and colour. Try again.");
      }
    });
  }

  const auto = getAutoCategoryKeys(cat.name);
  const effectiveColorKey = draftColor ?? auto.colorKey;
  const preview = resolveEffectiveCategoryStyle(cat.name, draftIcon, draftColor);
  const swatchIconWrap = effectiveColorKey ? categoryPaletteClasses(effectiveColorKey).iconWrap : "bg-muted text-muted-foreground";

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Customize icon & color"
      description={cat.name}
      footer={
        <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={handleSave}>
            Save changes
          </Button>
        </FormFooter>
      }
    >
      <CategoryStylePreview preview={preview} name={cat.name} />
      <div className="flex flex-col gap-2">
        <SwatchSectionHeader label="Icon" custom={draftIcon !== null} onReset={() => setDraftIcon(null)} />
        <IconSwatchGrid effectiveKey={draftIcon ?? auto.iconKey} isCustom={draftIcon !== null} swatchIconWrap={swatchIconWrap} onSelect={setDraftIcon} />
      </div>
      <div className="flex flex-col gap-2">
        <SwatchSectionHeader label="Color" custom={draftColor !== null} onReset={() => setDraftColor(null)} />
        <ColorSwatchGrid effectiveKey={effectiveColorKey} isCustom={draftColor !== null} onSelect={setDraftColor} />
      </div>
    </FormDialog>
  );
}
