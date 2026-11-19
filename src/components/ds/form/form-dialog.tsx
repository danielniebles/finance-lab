"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const NO_KEYBOARD_INPUTS = new Set(["checkbox", "radio", "date", "file", "range", "color", "button", "submit", "reset"]);

/** Whether focusing this element brings up the on-screen keyboard. */
export function opensKeyboard(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NO_KEYBOARD_INPUTS.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable === true;
}

/**
 * How far to scroll a container so `target` (top/bottom edges) sits inside
 * `view` with `margin` to spare; 0 when it already does. A target taller
 * than the view is aligned to its top.
 */
export function revealDelta(
  target: { top: number; bottom: number },
  view: { top: number; bottom: number },
  margin = 8,
) {
  if (target.top < view.top + margin) return target.top - view.top - margin;
  if (target.bottom > view.bottom - margin) {
    return Math.min(target.bottom - view.bottom + margin, target.top - view.top - margin);
  }
  return 0;
}

/**
 * Scrolls the focused field (with its label) into view inside the sheet's
 * body only. `scrollIntoView` would also scroll every ancestor, the page
 * included, and on iOS with the keyboard up that pans the whole screen and
 * pushes the sheet out of sight. Runs after the sheet has finished moving
 * for the keyboard (its transition is 150ms).
 */
function revealFocusedField(sheet: HTMLElement | null) {
  const active = document.activeElement;
  if (!sheet || !opensKeyboard(active) || !sheet.contains(active)) return;
  const body = active.closest<HTMLElement>("[data-form-body]");
  if (!body) return;
  const target = active.closest("[data-slot=field]") ?? active;
  const delta = revealDelta(target.getBoundingClientRect(), body.getBoundingClientRect());
  if (delta !== 0) body.scrollBy({ top: delta, behavior: "smooth" });
}

/**
 * Keeps a bottom sheet above the on-screen keyboard. iOS Safari doesn't
 * resize the page when the keyboard opens: it lays the keyboard over it, so
 * a `bottom: 0` sheet ends up behind the keyboard. The sheet is instead
 * hung from the bottom edge of the visual viewport (its offset + height,
 * in the same coordinates `position: fixed` uses) and capped to its height,
 * so its body scrolls and its buttons stay reachable. This never reads the
 * layout's height (`innerHeight`), which iOS 26 home-screen apps report
 * inconsistently while the keyboard is up. (Android Chrome resizes the page
 * itself thanks to `interactiveWidget`; the visible bottom is then the
 * screen's bottom.)
 *
 * Once the keyboard is up, the focused field is scrolled into view: a field
 * near the bottom of the form would otherwise stay focused but hidden.
 */
function useKeyboardAwareSheet(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!open || !vv) return;
    let frame = 0;
    let reveal: ReturnType<typeof setTimeout> | undefined;
    const scheduleReveal = () => {
      clearTimeout(reveal);
      reveal = setTimeout(() => revealFocusedField(ref.current), 200);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty("--vv-bottom", `${Math.round(vv.offsetTop + vv.height)}px`);
        el.style.setProperty("--vv-height", `${Math.round(vv.height)}px`);
      });
    };
    const onResize = () => {
      update();
      scheduleReveal(); // keyboard opened/closed: the visible area changed
    };
    // Moving to another field while the keyboard is already up doesn't
    // resize anything, so focus changes trigger the reveal too.
    const onFocusIn = () => scheduleReveal();
    update();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(reveal);
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);
  return ref;
}

/**
 * The one modal layout for forms: title, scrolling body, and a footer band
 * that stays put. On phones it becomes a bottom sheet (full width, anchored
 * to the bottom, body scrolls, buttons always reachable), on wider screens a
 * centred dialog. The phone/desktop switch is pure CSS (no hydration
 * flicker); only the keyboard offset is measured at runtime.
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
  /** `xl`: room for a side-by-side preview from `md` up. */
  size?: "md" | "lg" | "xl";
  children: React.ReactNode;
}) {
  const sheetRef = useKeyboardAwareSheet(open);
  const inner = (
    <>
      <div data-form-body className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">{children}</div>
      {footer && (
        // Phones: extra room under the buttons so the screen's rounded
        // corners don't clip them (more on top of the home-indicator inset).
        <div className="shrink-0 touch-none border-t border-border/60 bg-muted/40 px-5 py-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] sm:rounded-b-2xl sm:pb-3">
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
          { md: "sm:max-w-md", lg: "sm:max-w-xl", xl: "sm:max-w-xl md:max-w-235" }[size],
          // Phones: bottom sheet hung from the visible bottom, above the keyboard (useKeyboardAwareSheet).
          "max-sm:top-[var(--vv-bottom,100dvh)] max-sm:bottom-auto max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:-translate-y-full max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
          "max-sm:max-h-[calc(var(--vv-height,100dvh)-1rem)] max-sm:transition-[top,max-height] max-sm:duration-150",
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
