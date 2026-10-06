---
name: Finance Lab
description: Personal finance instrument panel — dark-first, data-dense, single-user desktop tool
colors:
  deep-slate: "oklch(0.11 0.012 250)"
  slate-surface: "oklch(0.155 0.01 250)"
  slate-raised: "oklch(0.22 0.01 250)"
  slate-border: "oklch(0.28 0.01 250)"
  signal-teal: "oklch(0.72 0.18 155)"
  on-teal: "oklch(0.10 0.01 155)"
  high-contrast: "oklch(0.92 0.006 250)"
  medium-contrast: "oklch(0.65 0.01 250)"
  alert-red: "oklch(0.68 0.22 25)"
  success-green: "oklch(0.762 0.157 164)"
  caution-amber: "oklch(0.80 0.15 80)"
  chart-blue: "oklch(0.62 0.18 250)"
  chart-yellow: "oklch(0.78 0.18 80)"
  chart-purple: "oklch(0.68 0.18 300)"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  body:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  "2xl": "18px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.on-teal}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.high-contrast}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.high-contrast}"
    rounded: "{rounded.lg}"
    height: "32px"
  card:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.high-contrast}"
    rounded: "{rounded.xl}"
    padding: "16px"
  input:
    backgroundColor: "oklch(0.28 0.01 250 / 30%)"
    textColor: "{colors.high-contrast}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
---

# Design System: Finance Lab

## 1. Overview

**Creative North Star: "The Instrument Panel"**

Finance Lab is a personal financial instrument. Like a well-calibrated dashboard on a piece of precision equipment, every element exists to communicate a reading. The UI does not decorate — it displays. Color signals status. Typography creates hierarchy. Space creates separation between readings. The user is an engineer running diagnostics on their own financial health, not a consumer being sold a feeling.

The system is dark by default because instruments live in dark rooms: screens at night, monitors under focused desk lights, two-in-the-morning check-ins. High contrast is not optional — it is the point. The background is deep and blue-tinted so that Signal Teal (the confirmation green) reads cleanly against it. Reds and ambers carry their full semantic weight.

This design explicitly rejects the language of consumer fintech: no loud gradient hero cards (a subtle, theme-controlled glow is allowed — see §7), no animated confetti on savings milestones, no "Excellent! 🎉" microcopy. It equally rejects generic SaaS dashboards — no navy-and-gold "professional finance" clichés, no frosted glass panels, no identical 3-column icon grids. It is private infrastructure, built for one user who knows exactly what they're looking at.

**Key Characteristics:**
- Dark-first, high-contrast; light mode exists but is secondary
- Data density is a feature, not a flaw
- Numbers always in JetBrains Mono; prose always in DM Sans; structure always in Sora
- Color is reserved for status: green = positive, red = negative/danger, amber = caution, teal = interactive
- No shadows; elevation through tonal layering only

---

## 2. Colors: The Signal Palette

A minimal status-driven palette. Deep Slate provides the canvas; Signal Teal is the sole interactive accent; three semantic colors (success, destructive, warning) carry financial meaning. All neutrals carry a faint hue (chroma 0.006–0.012) at hue 250 (blue-gray) to keep the dark surfaces from feeling dead.

### Primary
- **Signal Teal** (`oklch(0.72 0.18 155)`): The interactive accent. Used on primary buttons, active nav items, focus rings, progress fills, and links. Never used decoratively. Its relative scarcity is what makes it readable as "actionable."

### Secondary
- **Success Green** (`oklch(0.762 0.157 164)`): Income values, positive savings rates, "OK" category severity, paid installments. Slightly warmer hue than Signal Teal so the two never compete.
- **Alert Red** (`oklch(0.68 0.22 25)`): Overspent categories, destructive actions, error states, negative financial indicators. High chroma; commands attention.
- **Caution Amber** (`oklch(0.80 0.15 80)`): Issue-level category severity, warnings, medium-severity alerts. Never used for primary actions.

### Neutral
- **Deep Slate** (`oklch(0.11 0.012 250)`): Page background. The floor of the instrument panel.
- **Slate Surface** (`oklch(0.155 0.01 250)`): Card and popover background. One step up from the floor.
- **Slate Raised** (`oklch(0.22 0.01 250)`): Muted backgrounds, secondary surfaces, input fills. Two steps up.
- **Slate Border** (`oklch(0.28 0.01 250)`, 70% opacity): Borders and dividers. Subtle — structural, not decorative.
- **High Contrast** (`oklch(0.92 0.006 250)`): Primary text. Near-white with a whisper of blue to prevent harshness.
- **Medium Contrast** (`oklch(0.65 0.01 250)`): Secondary text, muted labels, metadata.
- **Sidebar** (`oklch(0.14 0.01 250)`): Slightly lifted from the page background, distinct enough to establish the app shell boundary without a visible border.

### Chart Colors
Five distinct hues for Recharts data visualization: Teal (chart-1), Blue (chart-2), Yellow-green (chart-3), Red (chart-4), Purple (chart-5). Never reuse semantic colors (success-green, alert-red) for chart series.

### Named Rules

**The Earned Color Rule.** Color signals meaning; it never decorates. If a teal element does not indicate interaction, a green element does not indicate success, or a red element does not indicate danger, it has no business being that color. Monochrome first, semantic color second.

**The One Accent Rule.** Signal Teal is the only interactive accent. It appears on at most 15% of any given screen. Its rarity makes it legible as "this is what you click." More than one teal element per section needs justification.

---

## 3. Typography

**Display/Heading Font:** Sora (with ui-sans-serif fallback)
**Body Font:** DM Sans (with ui-sans-serif fallback)
**Mono/Data Font:** JetBrains Mono (with ui-monospace fallback)

**Character:** Sora provides geometric precision in headings without feeling cold — its rounded terminals add just enough humanity. DM Sans is neutral and highly legible at small sizes. JetBrains Mono is the workhorse: every peso amount, every percentage, every installment count lives in mono. The triple-font system is a doctrine, not a convenience; it creates an immediate visual grammar where the user knows from type alone whether they're reading a label, a value, or an explanation.

### Hierarchy

- **Display** (Sora, 600, 1.5rem / 24px, lh 1.2, ls -0.01em): Page titles (`h1`). One per page. "Installments", "Expenses", "Overview."
- **Headline** (Sora, 500, 1rem / 16px, lh 1.4): Card titles, dialog titles, collapsible section headers. More than one per page.
- **Section Label** (Sora, 600, 0.75rem / 12px, UPPERCASE, ls 0.06em, `text-muted-foreground`): The `h2` pattern used throughout — "CREDIT CARDS", "DUE THIS MONTH", "ACCOUNTS." All uppercase, all Sora, all muted. Never sentence case.
- **Body** (DM Sans, 400, 0.875rem / 14px, lh 1.5): Prose content, form labels, notes, general UI text. The default scale.
- **Caption** (DM Sans, 400, 0.75rem / 12px, `text-muted-foreground`): Metadata, secondary information, "3 installments", dates under amounts.
- **Data** (JetBrains Mono, 600, variable size, lh 1.4): Every monetary amount, every percentage, every count that is a financial figure. Size scales with importance: `text-xl` (20px) for KPI hero numbers, `text-lg` (18px) for large amounts, `text-sm` (14px) for inline values.

### Named Rules

**The Mono Rule.** Every number that represents money, a rate, or a financial count is JetBrains Mono. No exceptions. DM Sans for financial numbers is a bug, not a style choice.

**The Label Rule.** Section headings (`h2` level and below) are always Sora, uppercase, 0.75rem, with muted foreground color. They establish hierarchy without competing with the data below them.

---

## 4. Elevation

Finance Lab uses tonal layering exclusively. No shadows at rest. Depth is communicated by background lightness stepping up: Deep Slate (page) → Slate Surface (card) → Slate Raised (muted/secondary fills) → popover/dropdown (same as card, but floated). The four tones are the full vocabulary.

Floating elements (tooltips, dropdowns, dialogs) use the same Slate Surface background but sit in a stacking context above the page. There is no ambient shadow to suggest lift — the floating element is simply present, which is enough.

Cards use `ring-1 ring-foreground/10` (a 10%-opacity foreground ring) rather than a border or shadow. This creates a defined edge that reads as a contained surface without adding visual weight. The ring is structural, not decorative.

### Named Rules

**The Flat-by-Default Rule.** Surfaces are flat at rest, always. If you reach for `box-shadow`, stop and ask whether tonal lift (a lighter background) achieves the same goal. Shadows are forbidden except on `<dialog>` overlays where stacking context demands it.

**The Four Floors Rule.** There are exactly four surface levels: page background, card, raised surface, popover. No improvised levels. New components must map to one of these four.

---

## 5. Components

### Buttons

Compact and functional. The default size (h-8, 32px) is the workhorse. No visual weight at rest beyond fill; all feedback is on interaction.

- **Shape:** Gently rounded (10px / `rounded-lg`); `rounded-md` (8px) at `sm` and `xs` sizes.
- **Primary:** Signal Teal fill (`oklch(0.72 0.18 155)`) with dark teal text (`oklch(0.10 0.01 155)`). Hover: darkens to `oklch(0.68 0.18 155)`. Active: `translate-y-px` (1px press).
- **Outline:** Transparent background, `border-border`, foreground text. Hover: fills with Slate Raised. The workhorse secondary action.
- **Ghost:** No border, no background. Hover: Slate Raised at 50% opacity. Used for icon buttons and low-priority inline actions.
- **Destructive:** Faint `alert-red/10` fill with `alert-red` text. On hover: `alert-red/20`. Never a solid red fill — alerts are warnings, not declarations.
- **Focus:** `ring-3` (3px) in Signal Teal at 50% opacity. Visible, not garish.

### Cards / Containers

The primary layout primitive for any grouped piece of information.

- **Corner Style:** Gently rounded (14px / `rounded-xl`) — slightly more generous than buttons.
- **Background:** Slate Surface (`oklch(0.155 0.01 250)`).
- **Shadow Strategy:** None. A `ring-1 ring-foreground/10` defines the edge. See Elevation.
- **Internal Padding:** 16px (`p-4`), 12px at `sm` size.
- **Footer:** Slate Raised background (`muted/50`), `border-t`, internal 16px padding. Used for actions or summary rows.

### Inputs / Fields

Understated. The field is there to receive input, not to announce itself.

- **Style:** Transparent background with a `border-input` stroke. In dark mode: `bg-input/30` (a faint Slate Raised tint). `rounded-lg` (10px). Height 32px.
- **Focus:** Border transitions to Signal Teal (`border-ring`). Ring 3px Signal Teal at 50% opacity.
- **Error:** Border and ring shift to `alert-red`. Ring is `alert-red/20`.
- **Disabled:** `pointer-events-none`, `opacity-50`, background fills to `input/80`.
- **Placeholder:** Medium Contrast (`muted-foreground`).

### Navigation (Sidebar)

Left-anchored collapsible sidebar. Sidebar background is Slate Sidebar (`oklch(0.14 0.01 250)`) — imperceptibly lighter than the page background, enough to establish the shell boundary without a divider line.

- **Nav items:** Icon + label, `text-sm`. Default: transparent, Medium Contrast text. Hover: Slate Raised at 50% opacity, foreground text. Active: Slate Raised, Signal Teal text — active state is color only, no indicator strip.
- **Section labels:** `text-xs uppercase tracking-wider text-muted-foreground` (Section Label scale). Grouped items sit under them.
- **Collapsible sub-items:** Indented, `text-xs`. Same hover/active pattern.

### StatCard (Signature Component)

The KPI summary card pattern used throughout every dashboard section: a labeled numeric reading.

- **Container:** `rounded-xl border bg-card px-5 py-4`
- **Label:** Section Label scale (Sora, 0.75rem, 600, UPPERCASE, `tracking-wider`, `text-muted-foreground`)
- **Value:** JetBrains Mono, `text-xl font-semibold`. Color role: `text-foreground` (neutral), `text-success` (positive metric), `text-destructive` (negative metric).
- **Sub-label (optional):** Caption scale, `text-muted-foreground`. One line only.

### Badge / Status Chip

Used for severity labels (OK / Issue / Critical / Unplanned), card tags ("Credit Card"), and status pills.

- **Shape:** `rounded-full px-2 py-0.5 text-xs font-medium`
- **Semantic colors:** `bg-success/10 text-success`, `bg-destructive/10 text-destructive`, `bg-warning/10 text-warning`, `bg-muted text-muted-foreground`.
- **Brand chips** (e.g. "Credit Card"): `bg-primary/10 text-primary`.

---

## 6. Do's and Don'ts

### Do:

- **Do** use JetBrains Mono for every monetary amount, percentage, and financial count — no exceptions.
- **Do** use Section Label scale (Sora, 0.75rem, 600, UPPERCASE, muted foreground) for all `h2`-level section headers.
- **Do** use `ring-1 ring-foreground/10` on cards instead of `box-shadow`.
- **Do** use semantic color correctly: Signal Teal for interactive elements, Success Green for positive values, Alert Red for negative/danger, Caution Amber for warnings.
- **Do** keep buttons at `h-8` (32px) by default; only go taller for primary CTAs that need emphasis.
- **Do** keep all neutrals at hue 250 (blue-gray) with low chroma (0.005–0.012). A warm gray or pure gray breaks the palette.
- **Do** derive balance, totals, and remaining amounts at query time — never display a stored computed value that could be stale.

### Don't:

- **Don't** use `box-shadow` on resting surfaces. Shadows are prohibited except on modal overlays.
- **Don't** use gradient text (`background-clip: text`). Financial data in gradient text is unreadable and decorative.
- **Don't** use `border-left` greater than 1px as a colored accent stripe. Rewrite with a full background tint, a leading icon, or nothing.
- **Don't** use decorative color. Signal Teal on a card title that is not interactive is a bug.
- **Don't** use DM Sans for numbers. This is the Mono Rule. A peso sign in DM Sans is wrong even if it "fits."
- **Don't** replicate Mint, YNAB, or consumer fintech aesthetics: no green-white-and-teal gradient heroes, no emoji in financial summaries, no confetti on positive milestones.
- **Don't** replicate generic SaaS dashboard patterns: no identical icon-heading-text card grids, no gradient accent cards, no hero metric template (big number + gradient swatch).
- **Don't** hard-code a gradient in a component. Decorative washes come only from the theme's `--surface-glow` via the `.surface-glow` class, so each theme decides (default light sets it to `none`).
- **Don't** add a fifth surface level. Deep Slate, Slate Surface, Slate Raised, Popover — that is the full elevation vocabulary.
- **Don't** use light-mode-only assumptions. The design is dark-first; any new component must read correctly in dark mode without adjustments.

---

## 7. Implementation: tokens, tones and `components/ds`

This section maps the rules above to code. Use it when building or migrating a screen.

### Themes

Four theme blocks in `src/app/globals.css`: `:root` (default light), `.dark` (default dark), `.signal` (Signal light), `.dark.signal` (Signal dark). Light/dark comes from the `theme` cookie; the family comes from `THEME_FAMILY`. **Every theme block defines every color token** — `src/app/theme-tokens.test.ts` fails CI if one is missing (only `--radius` may be inherited from `:root`).

To add a token: define it in all four blocks, map it in `@theme inline` as `--color-<name>`, then use it as a Tailwind class (`bg-<name>`, `text-<name>`).

| Token | Use |
|---|---|
| `background` / `card` / `muted` / `popover` | The Four Floors (§4) |
| `success` / `warning` / `destructive` | Positive / caution / danger status |
| `unplanned` | Spend with no budget (amber in default, indigo in Signal) |
| `info` | Informational status, neither good nor bad |
| `meter-track` | Unfilled part of meters and progress bars |
| `surface-glow` | Optional decorative wash for hero cards (`.surface-glow`); a theme sets `none` to opt out |
| `chart-1` … `chart-8` | Data series. Never status colors. |

### Status → color: `lib/status.ts`

Domain states never pick classes themselves. Map the state to a `Tone` (`positive`, `caution`, `danger`, `unplanned`, `info`, `neutral`) with the helpers (`toneForCategorySeverity`, `toneForVaultStatus`, `toneForRecurringStatus`, `toneForBudgetUsed`, `toneForSavingsRate`, `toneForLiquidity`; health score: `toneForTier` / `toneForMetricStatus` in `lib/health-score-utils.ts`), and pass the tone to a component. `TONE_CLASSES[tone]` gives `text`, `soft`, `fill` and `color` (a CSS `var()` for SVG/charts) when a component doesn't fit.

### Components (`src/components/ds`)

| Component | Replaces |
|---|---|
| `Money` | Ad-hoc `font-mono` + `formatCOP` spans. Handles sign, `compact` ($ 14.4M) and tone. |
| `StatusChip` | Per-screen `statusClasses()` / `statusPillClasses()` helpers |
| `Meter` | Inline progress bars; supports a target tick and is a real `role="meter"` |
| `StatCard` | Overview `KpiCard`, the StatCard spec in §5 |
| `SectionHeader` | Uppercase section labels + "View …" links |
| `PageHeader` | Page title (display style), one-line description and the page's main action on the right ("Add category"). The main action never sits at the bottom of a long list. |
| `ListRow` | Icon tile + title/subtitle + trailing rows (vaults, installments, debtors) |
| `ReadingGrid` | Label + amount readings that wrap instead of overflowing with long COP values |
| `ColorDot` | Dot in a user-chosen colour (account, card); muted token when there's none |

### Forms (`src/components/ds/form`)

Every modal form is built from these; no hand-rolled label or dialog styles.

| Component | Use |
|---|---|
| `FormDialog` + `FormFooter` | The modal: title, scrolling body, footer band with the actions on the right and an optional hint on the left ("Add an amount to save."). It is a bottom sheet on phones, with the footer always reachable. |
| `Field` | Label, muted "optional", hint or error. It also sizes the shadcn input/select inside it (40px, full width). |
| `FieldGroupLabel` / `FormReadout` | A group heading inside a form ("Optional links") / a read-only computed value ("Monthly payment $ 350.000"). |
| `MoneyInput` | Peso amounts. Holds a digit string and shows "$ 1.200.000" while typing, with the numeric keypad on phones. |
| `DateField` | Shows "Today, Oct 6" / "Mar 12, 2027" and opens the browser's own picker (`showPicker()`). No date library. Optional quick picks (Today / Yesterday); `clearable` adds an × for optional dates. |
| `OptionSelect` | Dropdown that always shows the option label (base-ui otherwise shows the raw value), with an optional leading icon or dot and an optional "None" → `null`. |
| `SegmentedControl` | 2–4 exclusive options. The selection is neutral, never a status colour. |
| `TagInput` | Tags as chips. The value is the same comma-separated string as before. |
| `ColorPicker` | Preset colours for something the user owns (vault, account, card); optional "No colour". |
| `CheckField` | A yes/no option: checkbox, label and hint, the whole row tappable. |
| `RowDeleteButton` (`components/shared`) | Delete inside a log list: first tap arms "Delete?", the second deletes. Never `window.confirm`. |

Labels are sentence case; uppercase is only for group headings. Primary actions are named for what they do ("Add expense", "Create expense", "Save changes").

Reference page: `/settings/design-system` (dev only) renders every token and component. Check it in light and dark, and with `THEME_FAMILY=signal`, after any token change.

### Rules

- No raw palette classes (`text-red-500`, `bg-black/50`), hex, `rgb()` or `oklch()` in components, pages or lib — use tokens. Enforced by `src/lib/design-system-guard.test.ts`. Exceptions are user data (category hues in `lib/category-style.ts`, colour presets in `lib/color-presets.ts`) and colours rendered outside the page (app icon, manifest, `themeColor`).
- Status color only through `lib/status.ts`.
- Money only through `<Money>`.
