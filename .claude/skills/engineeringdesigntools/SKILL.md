---
name: engineeringdesigntools
description: Apply the EngineeringDesignTools dark "instrument / precision" visual theme to the browser-based structural-engineering calculator suite in this repo (single-file HTML tools like ConnectionCheck.html, RC Column Design.html, RC Crack Width.html, Concrete Tie Force.html, index.html). Use this whenever building a NEW tool for the suite, restyling or refreshing an existing tool, adding a results panel / chart / diagram, or any time the user wants a calculator or engineering tool to look "on brand", consistent with the other tools, less generic, or "less AI". It defines the colour tokens (charcoal canvas + a single amber accent), Saira + JetBrains Mono typography, sharp 2px chrome, the component patterns, dark Chart.js/canvas config, and the rules that keep printed PDF reports and SVG drawing sheets light. Reach for it even if the user does not name the theme explicitly.
---

# EngineeringDesignTools theme

A cohesive **dark "instrument / precision"** design language for the Engineering Tools
suite: tools that should read like purpose-built engineering software (a CAD viewport,
a measurement instrument), not a generic SaaS template. The whole point is to avoid the
default "AI slop" look (warm off-white canvas, purple accents, system fonts, soft rounded
cards) while staying credible for a UK structural-engineering practice.

The fastest way to get the look right is to reuse the bundled assets:
- `assets/theme.css` - the `:root` tokens plus a reusable component set. Copy the tokens
  and base rules into the tool's `<style>` (these are single-file HTML tools, so CSS is
  embedded per file, not linked).
- `assets/starter.html` - a minimal two-column tool shell wired to the tokens.

Read those two files first. The rest of this document explains the decisions so you can
extend the system sensibly rather than copy it blindly.

## Core decisions (keep these invariant)

- **One canvas, one accent.** Charcoal `--bg:#0e1014` (never pure black). Exactly one
  decorative accent, phosphor amber `--accent:#ffb000`, used for interactive/active chrome
  (focus rings, active tabs, primary button, section titles, links on hover). Do not
  introduce a second brand colour. Purple is banned entirely.
- **Semantic colour is functional, not decorative.** Green `--pass` and red `--fail` are
  for results (pass/fail, utilisation) only. A chart that genuinely needs two data series
  may use amber + `--data2` cyan; that is data encoding, not a second accent.
- **One sharp corner radius.** `--r:2px` everywhere. No mixed 8px/10px rounded cards.
- **Typography.** `--sans:Saira` for UI/labels/headings; `--mono:'JetBrains Mono'` for
  every number, code, unit and formula. Load both from Google Fonts with a system fallback
  (see the `<link>` in `starter.html`). These tools run offline-capable, so the fallback
  matters; `display=swap` avoids blocking.
- **Header is a title block.** Slim sticky bar, uppercase wordmark with one amber word,
  mono standards meta on the right. See `.et-header`.

## Two things that must stay LIGHT (the most common mistake)

These tools generate printed output and engineering drawings. The dark theme is for the
**on-screen app only**.

1. **PDF / printed reports stay white.** Reports are built with jsPDF primitives and by
   rasterising freshly-created **white** KaTeX `<div>`s (`html2canvas(..., {backgroundColor:
   '#ffffff'})`). They are independent of the screen CSS - do not "theme" them, and never
   route the dark page colours into the report. If a tool captures an on-screen DOM node
   into the PDF, give that node a light scope so text stays dark-on-white.
2. **SVG drawing sheets stay light.** Engineering diagrams are ink lines + light steel
   fills designed for a white sheet. Render them inside a light viewport (`.et-sheet`,
   `background:#fff`) sitting within the dark UI, so they remain legible and match the PDF.
   Annotations drawn *on* the sheet (e.g. amber callouts) keep their on-sheet colours.

## Data visualisation on the dark canvas

Charts default to dark text/grid and vanish on `--bg`. Retune them:

- **Chart.js**: set `scales.x/y.grid.color` and `ticks.color` to `#2a2f38` / `#8b93a0`,
  axis `title.color` to `#8b93a0`, font family to `JetBrains Mono`. Tooltip:
  `backgroundColor:'#16191f'`, `borderColor:'#3a4250'`, `titleColor:'#e6e8ec'`,
  `bodyColor:'#8b93a0'`. Series colours: brighten to the bright tokens
  (`#3ecf8e` pass, `#ff5d5d` fail, `#ffb000` amber, `#4cc9f0` cyan for a 2nd series); never
  use `#1a1a1a` for a line (invisible) - use a light grey like `#cdd5e0`.
- **Hand-drawn `<canvas>`** (e.g. cross-sections): fill the member with
  `rgba(255,255,255,0.05)`, outline in `--pass` green, draw axis/centre lines in `--data2`
  cyan, and rebar/markers in bright `#ff5d5d` / `#ffb000`. Brighten any `#2e7d22 / #c0392b /
  #e67e22 / #8a7fcc` literals to their bright equivalents.

## Copy / anti-slop rules (these read as "AI tells" if ignored)

- **No em-dashes or en-dashes anywhere visible** (`—` `–`). Use a normal hyphen `-`.
  This includes labels, option text, headings, and PDF strings. A quick final pass:
  replace `—`->`-` and `–`->`-` across the file (tidy any `<em>— ` label pattern to `<em>`
  first so you do not get a leading "- " in italic sublabels).
- **No decorative emoji** in titles/labels. Keep only the *semantic* glyphs `✓` (pass) and
  `⚠` (warning).
- **Ration the middle-dot `·`** - at most one per metadata line; prefer slashes, commas or
  line breaks for chains like "A · B · C".
- **No decorative status dots, fake revision/version/build stamps, or section-number
  eyebrows** (`01 / 02`). Identify modules by their real standard code (P358, C766, EC2).
- **One primary action per panel.** The primary button is solid amber with near-black text
  (`#1a1208`) - check the contrast holds. Everything else is a ghost button.
- Add `@media (prefers-reduced-motion:reduce){*{transition:none!important;}}` and keep
  motion minimal and mechanical (fast linear transitions, amber focus rings).

## How to apply

### New tool
Start from `assets/starter.html`, paste the `assets/theme.css` tokens + base components into
its `<style>`, then build the tool's specific layout/results on top using the `.et-*`
classes. Add it to `index.html`'s module list keyed by its standard code.

### Restyling an existing tool
Keep all calculation JS, formulas, KaTeX strings, IDs and handlers untouched - this is a
visual pass only. Add the `:root` token block at the top of the `<style>`, add the fonts
`<link>`, then convert every rule and inline style with this mapping:

| Old (generic light)                              | New token            |
|--------------------------------------------------|----------------------|
| page bg `#f5f4f1`                                | `var(--bg)`          |
| card/surface `#fff`                              | `var(--surf)`        |
| inset/input bg `#fafaf8`, `#f5f4f1`-as-inset     | `var(--surf2)`       |
| borders `#e0ddd8` / `#f0ede8`                    | `var(--bdr)`         |
| input borders `#d4d0ca`                          | `var(--bdr2)`        |
| text `#1a1a1a` / `#333`                          | `var(--txt)`         |
| muted `#555` `#666` `#777`                       | `var(--mut)`         |
| faint `#888` `#999`                              | `var(--faint)`       |
| any purple `#8a7fcc`, `rgba(138,127,204,..)`     | `var(--accent)`      |
| greens `#2e7d22` `#e8f5e1` `#b8dda0`             | `var(--pass)` + `rgba(62,207,142,.1)` tint |
| reds `#c0392b` `#fceaea` `#f0b0b0`               | `var(--fail)` + `rgba(255,93,93,.1)` tint  |
| amber/orange `#e67e22` `#fff9e6` `#fffdf5`       | `var(--accent)` / `var(--accent-dim)`      |
| any `border-radius:4-10px`                       | `var(--r)` (keep `50%`) |
| `'SF Mono',...`                                  | `var(--mono)`        |
| `-apple-system,...`                              | `var(--sans)`        |

Watch for cream "warning"/"not in code" callout boxes (`#fffdf5`/`#7a4f00`) generated in JS
- restyle them to `.et-note` (amber-dim), not left light.

## Verify before finishing

Grep the file(s): zero `8a7fcc`, zero `—`/`–`, `:root` accent token present, fonts `<link>`
added, `prefers-reduced-motion` present. The only remaining `#fff`/light literals should be
the `.et-sheet` drawing viewport, the `@media print` block, and SVG diagram fills. Then open
in a browser, run a calculation (pass/fail still green/red), export the PDF (must still be
white), and confirm any chart/diagram is legible on the dark canvas.
