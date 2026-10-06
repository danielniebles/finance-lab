"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Keeps a bottom sheet above the on-screen keyboard. iOS Safari doesn't
 * resize the page when the keyboard opens: it lays the keyboard over it, so
 * a `bottom: 0` sheet ends up behind the keyboard and the page scrolls
 * underneath. The visual viewport tells us how much of the screen the
 * keyboard covers; the sheet is lifted by that much and capped to what's
 * visible, so its body scrolls and its buttons stay reachable. (Android
 * Chrome resizes the page itself thanks to `interactiveWidget` in the root
 * layout; the inset is then 0.)
 */
function useKeyboardAwareSheet(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!open || !vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        el.style.setProperty("--kb-inset", `${Math.round(inset)}px`);
        el.style.setProperty("--vv-height", `${Math.round(vv.height)}px`);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);
  return ref;
}

/**
 * The one modal layout for forms: title, scrolling body, and a footer band
 * that stays put. On phones it becomes a bottom sheet (full width, anchored
 * to the bottom, body scrolls, buttons always reachable), on wider screens a
 * centred dialog. Pure CSS — no viewport hooks, so no hydration flicker.
 *
 * Pass `onSubmit` to wrap body + footer in a <form> (submit buttons in the
 * footer then work with Enter).
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  footer,
  size = "md",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  const sheetRef = useKeyboardAwareSheet(open);
  const inner = (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">{children}</div>
      {footer && (
        <div className="shrink-0 touch-none border-t border-border/60 bg-muted/40 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={sheetRef}
        className={cn(
          "flex max-h-[min(92dvh,52rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 bg-card p-0 ring-0",
          size === "lg" ? "sm:max-w-xl" : "sm:max-w-md",
          // Phones: bottom sheet, lifted above the keyboard (useKeyboardAwareSheet).
          "max-sm:top-auto max-sm:bottom-[var(--kb-inset,0px)] max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
          "max-sm:max-h-[calc(var(--vv-height,100dvh)-1rem)] max-sm:transition-[bottom,max-height] max-sm:duration-150",
        )}
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 touch-none rounded-full bg-border sm:hidden" />
        {/* touch-none on the fixed parts: a swipe there must not scroll the page behind. */}
        <div className="shrink-0 touch-none px-5 pt-3 pb-3 pr-12 sm:pt-5">
          <DialogTitle className="font-heading text-lg font-semibold">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {inner}
          </form>
        ) : (
          inner
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Footer row: an optional hint on the left ("Add an amount to save."), the
 * actions on the right. On phones the actions share the full width.
 */
export function FormFooter({ hint, children }: { hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className={cn("text-xs text-muted-foreground", !hint && "max-sm:hidden")} aria-live="polite">
        {hint}
      </p>
      <div className="flex flex-wrap gap-2 max-sm:[&>*]:h-11 max-sm:[&>*]:flex-1 sm:justify-end">{children}</div>
    </div>
  );
}
