"use client";

import { domToBlob } from "modern-screenshot";

// Browser-only helpers to hand a rendered card to another app. Clipboard
// image writes and file shares need HTTPS (or localhost) and a click.

export function renderPng(node: HTMLElement): Promise<Blob> {
  // Layout size, not getBoundingClientRect: the dialog's zoom-in transform
  // would otherwise shrink the capture.
  const size = { width: node.offsetWidth, height: node.offsetHeight };
  return document.fonts.ready.then(() => domToBlob(node, { ...size, scale: 2, type: "image/png" }));
}

/** Phones and tablets that can hand a PNG to the share sheet (WhatsApp …). */
export function canShareImage(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const probe = new File([""], "probe.png", { type: "image/png" });
  return coarse && navigator.canShare({ files: [probe] });
}

/** Opens the share sheet. Resolves false when the user dismisses it. */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<boolean> {
  try {
    await navigator.share({ files: [new File([blob], filename, { type: "image/png" })], text });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return false;
    throw e;
  }
}

/** Copies the image; falls back to downloading it. Returns which happened. */
export async function copyImage(blob: Blob, filename: string): Promise<"copied" | "downloaded"> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "copied";
  } catch {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  }
}
