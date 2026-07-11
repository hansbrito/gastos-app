# Gastos — Design System

Mobile-first dashboard for a couple reducing expenses. No build step: native ES modules,
tokens as CSS custom properties, components as pure render functions.

## Principles

1. **One primary number per screen.** The Resumo hero is the month total; everything else supports it.
2. **"What drains us", never "who spends more".** No per-person aggregation, ranking, or charts — ever.
   Attribution on individual records (avatar initial) is provenance, not comparison.
3. **Money semantics:** green = spending went down, red = spending went up. Not profit/loss colors.
4. **Honest comparisons:** month-vs-month always cuts both months at the same day-of-month.
5. **Every state designed:** loading (skeleton), empty (icon + next action), error (message + reason).

## Tokens (`styles/tokens.css`)

- **Color:** semantic aliases only in components (`--color-primary`, `--color-negative`, …).
  Raw brand scale (`--brand-*`) never leaves tokens.css. Light + dark via `prefers-color-scheme`.
- **Type:** 12/13/15/17/22/34/40. Money always with `.num` (tabular numerals).
- **Spacing:** 4px grid — `--s-1`(4) … `--s-6`(32).
- **Shape:** radius 10/16/full; two elevation levels.
- **Touch:** every control ≥ `--touch-target` (44px); inputs 16px font (blocks iOS zoom).

## Components (`styles/components.css` + `js/ui.js`)

| Component | Class | Renderer |
|---|---|---|
| Button | `.c-btn --primary/--ghost/--link` | inline |
| Card | `.c-card` | `card()` |
| Hero stat | `.c-stat` | `stat()` |
| Trend chip | `.c-chip --positive/--negative/--neutral` | `chip()` |
| Category bar | `.c-cat` | `catRow()` |
| Transaction | `.c-tx` | `txRow()` |
| Segmented control | `.c-seg` (aria-selected) | inline |
| Bottom nav + FAB | `.c-nav` (aria-current) | `nav()` |
| Bottom sheet | `.c-overlay/.c-sheet` | `sheet()` |
| Toast | `.c-toast` (role=status) | `toast()` |
| Skeleton / Empty | `.c-skel` / `.c-empty` | `skeleton()` / `empty()` |

## Charts (`js/charts.js`)

**Apache ECharts 5** (Apache-2.0, CDN ESM, SVG renderer). Theme derives from tokens at
runtime, so charts match light/dark automatically. All charts: confined tooltips (tap),
resize on viewport change.

- `monthlyBars` — totals per month, current month highlighted.
- `waterfall` — "O que mudou": last month (same-day cutoff) → per-category delta → this month.
  Red bar = category grew, green = category shrank. Top 6 deltas + "Outras" bucket.

## Conventions

- Views are `js/views/*.js`, exported `render<Name>(el, ...)`; pure HTML-string components in `ui.js`.
- All dynamic text through `esc()` — no exceptions.
- Aggregations live in `store.js`, never in views.
- A11y: `aria-selected/pressed/current`, `role=dialog/status`, `:focus-visible` rings,
  `prefers-reduced-motion` kills animation.
