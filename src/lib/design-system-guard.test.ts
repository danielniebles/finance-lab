// @vitest-environment node
//
// Guard for the design-system colour rule (CLAUDE.md "UI rules", DESIGN.md §7):
// components and pages take colours only from theme tokens, so every theme
// (default/Signal × light/dark) is respected. Fails with file:line when a raw
// Tailwind palette class, hex, rgb()/hsl()/oklch() shows up.
//
// Fix a hit by using a token (bg-card, text-muted-foreground, bg-chart-3 …),
// a tone from lib/status (TONE_CLASSES / StatusChip / Meter / Money) or
// <ColorDot> for user-chosen colours. Only add to ALLOWED with a reason.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SCAN = ["src/components", "src/app", "src/lib"];

/** Files that legitimately need literal colours. */
const ALLOWED: Record<string, string> = {
  // Generated PNG icon and browser chrome colour: rendered outside the page,
  // where CSS variables don't exist.
  "src/app/apple-icon.tsx": "generated app icon",
  "src/app/layout.tsx": "viewport themeColor metadata",
  "src/app/manifest.ts": "PWA manifest colours",
  // User-chosen data, not styling decisions: the 11 category hues are stored
  // by name and picked in Settings; preset hexes seed account/card colours.
  "src/lib/category-style.ts": "user-selectable category hues",
  "src/lib/color-presets.ts": "user colour presets (stored as hex)",
  "src/lib/design-system-guard.test.ts": "this file",
};

const HUES =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const UTILS = "bg|text|border|from|via|to|ring|fill|stroke|outline|divide|decoration|shadow|accent|caret|placeholder";

const RULES: { name: string; re: RegExp }[] = [
  { name: "raw palette class", re: new RegExp(`\\b(?:${UTILS})-(?:(?:${HUES})-\\d{2,3}|black|white)\\b`) },
  { name: "hex colour", re: /["'`(\s:]#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/ },
  { name: "colour function", re: /(?<![a-zA-Z0-9-])(?:rgba?|hsla?|oklch|oklab)\(/ },
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path.endsWith(join("components", "ui")) ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\s*\/\*)/.test(line);

function violations(): string[] {
  const out: string[] = [];
  for (const path of SCAN.flatMap((d) => files(join(ROOT, d)))) {
    const rel = relative(ROOT, path).split("\\").join("/");
    if (ALLOWED[rel]) continue;
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (isComment(line)) return;
        for (const rule of RULES) {
          const hit = line.match(rule.re);
          if (hit) out.push(`${rel}:${i + 1} ${rule.name}: ${hit[0].trim()}`);
        }
      });
  }
  return out;
}

describe("design-system colour guard", () => {
  it("components and pages use theme tokens only", () => {
    expect(violations()).toEqual([]);
  });

  it("the rules catch what they should", () => {
    const hits = (s: string) => RULES.filter((r) => r.re.test(s)).map((r) => r.name);
    expect(hits('className="text-amber-600"')).toEqual(["raw palette class"]);
    expect(hits('className="bg-black/50"')).toEqual(["raw palette class"]);
    expect(hits('color ?? "#888"')).toEqual(["hex colour"]);
    expect(hits("shadow-[0_8px_30px_rgba(0,0,0,0.4)]")).toEqual(["colour function"]);
    expect(hits('className="bg-chart-3 text-success border-border/60"')).toEqual([]);
    expect(hits('href="#category-breakdown"')).toEqual([]);
  });
});
