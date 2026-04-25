/**
 * Curated oklch palette for data visualisation.
 * Consistent lightness (0.68) and chroma (0.14) with varied hues so all
 * colours look equally prominent in both light and dark themes.
 */
export const CHART_PALETTE = [
  "oklch(0.68 0.14 200)", // sky
  "oklch(0.68 0.14 280)", // violet
  "oklch(0.68 0.14 55)",  // gold
  "oklch(0.68 0.14 325)", // rose
  "oklch(0.68 0.14 230)", // cornflower
  "oklch(0.68 0.14 30)",  // tangerine
  "oklch(0.68 0.14 175)", // teal
  "oklch(0.68 0.14 300)", // magenta
  "oklch(0.68 0.14 80)",  // lime
  "oklch(0.68 0.14 250)", // periwinkle
  "oklch(0.68 0.14 350)", // coral
  "oklch(0.68 0.14 155)", // seafoam
] as const;

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
