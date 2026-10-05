import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guards the theming contract: every theme block in globals.css must define
// the same set of CSS custom properties. Components only reference tokens
// (bg-card, text-success, bg-meter-track, …), so a token missing from one
// theme silently falls back to another theme's value — or to nothing —
// and only shows up visually. This test makes that a CI failure instead.

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

/** Returns the custom-property names declared directly in `selector { … }`. */
function tokensOf(selector: string): Set<string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`Theme block "${selector}" not found in globals.css`);
  const body = match[1].replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
}

const THEMES = [":root", ".dark", ".signal", ".dark.signal"] as const;

// Non-color tokens a theme may deliberately inherit from :root (the theme
// classes sit on <html> together with :root, so they cascade). Colors are
// never allowed here: an inherited color is how one theme's palette leaks
// into another.
const INHERITABLE = new Set(["--radius"]);

describe("theme tokens", () => {
  const sets = Object.fromEntries(THEMES.map((t) => [t, tokensOf(t)])) as Record<
    (typeof THEMES)[number],
    Set<string>
  >;
  const all = new Set(THEMES.flatMap((t) => [...sets[t]]));

  it.each(THEMES)("%s defines every token used by any theme", (theme) => {
    const missing = [...all]
      .filter((token) => !sets[theme].has(token) && !INHERITABLE.has(token))
      .sort();
    expect(missing).toEqual([]);
  });

  it("every token mapped in @theme inline is defined by the themes", () => {
    const themeInline = /@theme inline\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    const referenced = [...themeInline.matchAll(/var\((--[\w-]+)\)/g)]
      .map((m) => m[1])
      // Fonts come from next/font variables on <html>, not from theme blocks.
      .filter((v) => !v.startsWith("--font-"));
    const undefinedTokens = referenced.filter((v) => !sets[":root"].has(v)).sort();
    expect(undefinedTokens).toEqual([]);
  });
});
