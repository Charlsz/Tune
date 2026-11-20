---
name: Tune
description: Operational flood analysis UI — ink on paper floating over the map.
colors:
  ink: "#111111"
  paper: "#ffffff"
  ink-soft: "#545454"
  muted: "#a0a0a0"
  line: "#dbdbdb"
  line-strong: "#a0a0a0"
  accent-soft: "#f1f1f1"
  fg: "#303642"
  fg-muted: "#657086"
  fg-soft: "#8993a4"
  danger: "#c4382d"
  data-agree: "#15803d"
  data-flood: "#e63946"
  data-water: "#2563eb"
  data-persistent: "#1d4e89"
  data-receded: "#94a3b8"
  map-bg: "#dce1d6"
  panel-border: "#e4e6eb"
  search-border: "#e7e9ee"
  running: "#eff3fd"
  empty-surface: "#f7f8fb"
  skeleton: "#e8eaef"
typography:
  display:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.45px"
  headline:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.2px"
  body:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 460
    lineHeight: "20px"
    letterSpacing: "-0.006em"
  label:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  panel: "24px"
  panel-sm: "16px"
  chrome: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  button-outline-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.none}"
    padding: "8px 0px"
  panel-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.panel}"
    width: "360px"
  nav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 14px"
    typography: "{typography.body}"
  nav-tab-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 14px"
  search-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "52px"
    padding: "0 20px"
  panel-callout:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  empty-box:
    backgroundColor: "{colors.empty-surface}"
    textColor: "{colors.fg-soft}"
    rounded: "{rounded.sm}"
    padding: "16px"
---

# Design System: Tune

## 1. Overview

**Creative North Star: "The Operational Notebook"**

Tune is a precise, sober, technical product surface: black ink on white paper floating over a working map. The primary chrome is not a dashboard grid — it is a narrow operational panel (Mapa / Resultados / Historial) and a matching search column, soft-lifted above Sentinel imagery. Docs is the same voice at full reading width under the shared header. Density is high where data lives; ornament is absent.

The system rejects SaaS dashboards genéricos, púrpuras/glow “AI”, cards decorativas sin acción, hero-métricas de marketing, and tipografía display ruidosa. Identity stays contained: ink/paper, Inter only, radius 0 on CTAs, soft floating chrome, purposeful motion (spinners/skeletons/fade-up — never bounce or decorative choreography).

**Key Characteristics:**
- Light-only product theme (`color-scheme: light`); paper ground, ink type.
- Floating panel as primary chrome over the map; sidebar as an alternate layout, not a second visual language.
- Sharp CTAs (`rounded-none`) vs soft chrome radii (`sm` / `md` / `lg` / `pill`).
- Product type scale tops out near ~21–22px; no marketing display stack.
- Data colors reserved for flood / agree / water / persistent / receded semantics.

## 2. Colors

Restrained light palette: near-black ink, white paper, cool slate foregrounds, and semantic data hues that never become brand decoration.

### Primary
- **Operational Ink** (`#111111`): Primary accent and CTA fill; icons, focus rings, selected segment fills. Rarity is intentional — ink is the action color, not a wash.
- **Paper** (`#ffffff`): App ground, panel fills, search shell, header bar.

### Neutral
- **Ink Soft** (`#545454`): Secondary text actions (`btnText`); CSS source is `color-mix(in srgb, #111111 72%, transparent)`.
- **Muted** (`#a0a0a0`): Quiet metric labels; CSS source `color-mix(... 40%, transparent)`.
- **Line / Line Strong** (`#dbdbdb` / `#a0a0a0`): Hairline borders; CSS sources `15%` / `40%` ink mixes. Prefer tokens over hard borders thicker than 1px.
- **Accent Soft** (`#f1f1f1`): Selected nav tabs, callouts, outline-selected buttons, hover washes; CSS source `6%` ink mix.
- **Foreground / Muted / Soft** (`#303642` / `#657086` / `#8993a4`): Body hierarchy inside panels (lead, meta, secondary copy).
- **Panel Border / Search Border** (`#e4e6eb` / `#e7e9ee`): Floating chrome outlines (panel vs search pill).
- **Map Ground** (`#dce1d6`): Leaflet map canvas behind tiles.
- **Empty Surface / Skeleton** (`#f7f8fb` / `#e8eaef`): Empty states and loading shimmer bases.
- **Running Wash** (`#eff3fd`): Token for in-flight analysis surfaces when used.

### Semantic (data, not brand)
- **Flood** (`#e63946`): New water / flood mask emphasis.
- **Agree** (`#15803d`): GFM agreement positive.
- **Water** (`#2563eb`): Water detection / toggle affordance.
- **Persistent** (`#1d4e89`): Permanent water.
- **Receded** (`#94a3b8`): Receded water.
- **Danger** (`#c4382d`): Errors and alerts only.

### Named Rules
**The Ink/Paper Rule.** Brand color is ink on paper. No purple, no neon, no glassmorphism, no glow accents. If a screen needs “energy,” raise contrast with ink — do not introduce a second brand hue.

**The Data-Only Hue Rule.** `data-*` colors appear only on map layers, legends, and metric semantics. They never paint CTAs, nav, or decorative cards.

## 3. Typography

**Display Font:** Inter Variable (with Inter, sans-serif)
**Body Font:** Inter Variable (with Inter, sans-serif)
**Label/Mono Font:** same family (no mono brand face)

**Character:** A single technical sans with optical size discipline. Features `cv11` + `ss01`, antialiased. Weight 460 at root feels slightly heavier than regular without shouting.

### Hierarchy
- **Display** (600, 22px, line-height 1, tracking −0.04em): Wordmark “Tune” in the header — the strongest brand type signal, still product-scale.
- **Title** (600, 21px / responsive 19–23px, tight leading, tracking −0.45px): Panel titles (Mapa / Resultados / Historial / Docs h1).
- **Headline** (600, 15px, tracking −0.2px): Section heads inside Docs and dense panel subsections.
- **Body** (460, 14px / 20px, tracking −0.006em): Root UI copy; Docs lead may sit at 14px on `fg` with max ~65ch.
- **Label** (400, 11–12px): `panelMeta`, metric captions, history timestamps; leads use 12px `fg-muted`. Primary CTA label is 14px medium; outline buttons 13px.

### Named Rules
**The Product Scale Rule.** Type tops out near 21–22px for product chrome. Forbidden: noisy display stacks, oversized marketing headlines, or a second decorative family.

**The Inter-Only Rule.** All product UI uses Inter Variable. Do not introduce serif display or geometric “AI” faces.

## 4. Elevation

Hybrid: most surfaces are flat tonal paper; depth appears only on floating chrome over the map — soft, cool, low-contrast shadows (blue-ink tint `#153248…`), never hard offsets or neon glows.

### Shadow Vocabulary
- **Panel float** (`box-shadow: 0 5px 22px #15324818`): Primary floating panel (`panelCard`).
- **Search float** (`box-shadow: 0 3px 12px #15324816`): Place search pill.
- **Dropdown** (`box-shadow: 0 8px 20px #12253520`): Search results sheet.
- **Map chip** (`box-shadow: 0 3px 12px #15324815`): Status banners and map control buttons.
- **Map chip quiet** (`box-shadow: 0 2px 8px #15324812`): Compact map toggles.
- **Leaflet control** (`box-shadow: 0 3px 10px #142b4015`): Native map control chrome.

Sidebar variant and mobile stacked panel drop the float shadow and become edge-flush paper.

### Named Rules
**The Soft Float Rule.** Shadows are ambient lift for chrome over cartography. If a shadow looks like a 2014 card (dark, tight blur, hard offset), it is wrong. No glassmorphism / backdrop-blur brand treatments.

**The Radius Split Rule.** CTAs, nav tabs, and list rows: `0px`. Floating panel: `16px` (`rounded-lg`). Search: pill. Nested controls: `8px`/`12px`. Never round a primary button.

## 5. Components

Components are operational, not decorative — every surface either advances the flood workflow or reports its state honestly.

### Buttons
- **Shape:** Dead-square corners (`0px`). Full width in panels is the default for primary/outline.
- **Primary:** Ink fill, paper text, 1px ink border, `min-height` 48px, padding 12×16, 14px medium; hover = ink at 90% opacity. Disabled at 45% opacity.
- **Outline:** Paper fill, ink text, `border-line`, 13px; hover washes `accent-soft`. Selected outline uses `line-strong` + `accent-soft` fill.
- **Text:** Transparent, 11px `ink-soft`, no border; used for tertiary panel actions.
- **Focus:** 2px ink outline, 2px offset (global).

### Chips
- **Style:** Segmented mode switch sits in a `rounded-md` track with `accent-soft` fill; active segment is ink/paper, inactive is transparent `fg-muted`. Map mode chips are compact `rounded-sm` with quiet shadow. Not marketing pills.

### Cards / Containers
- **Corner Style:** Floating panel `16px`; callouts/empty `8px`; sidebar panel `0`.
- **Background:** Paper. Callouts use `accent-soft`. Empty states use `#f7f8fb`.
- **Shadow Strategy:** Soft float only in floating variant (see Elevation).
- **Border:** `panel-border` when floating; `line` when sidebar edge.
- **Internal Padding:** 24px desktop (`p-6`), 20px tablet, 16px compact; section gap 24px → 16px compact.
- **Width:** Floating column 360px (386 xl / 320 lg), left inset 24px chrome.

### Inputs / Fields
- **Style:** Place search is a pill shell (52px tall) with `search-border`, paper fill, 15px input text. Date fields: `rounded-sm`, `border-line`, padding 12×12; focus shifts border to ink.
- **Focus:** Global 2px ink ring; search input itself is borderless inside the shell.
- **Error / Disabled:** Danger text for alerts; disabled controls at 45% opacity.

### Navigation
- **Header:** 64px (72px large) paper bar, bottom `border-line`, horizontal padding 24px. Wordmark 22px semibold + 32px mark, separated by `line-strong`.
- **Tabs:** Square, 14px; active = `accent-soft` + semibold; inactive transparent. Docs tab mirrors style, muted when idle, pushed `ml-auto`.

### Floating Panel (signature)
Primary product chrome: absolute paper column over the map (`z-700`), soft shadow, `rounded-lg`, hosts Wizard / Results / History via `PanelHeader` (optional 25px ink icon + title). On small screens it stacks full-width, loses radius/shadow, and becomes document flow. DocsPage reuses the same type tokens in a max-width ~42rem reading column — same system, different layout.

## 6. Do's and Don'ts

### Do:
- **Do** keep identity contained: ink (`#111111`) / paper (`#ffffff`), Inter Variable, radius 0 on CTAs, soft floating chrome.
- **Do** treat inundación as **agua nueva** (cambio), not total water — metrics and copy must match that doctrine.
- **Do** degrade honestly: missing GFM or scenes are stated in-panel without blocking the rest of the flow.
- **Do** use motion only for operational feedback (`animate-fade-up`, spinners, skeletons) and honor `prefers-reduced-motion`.
- **Do** reserve `data-flood` / `data-agree` / `data-water` / `data-persistent` / `data-receded` for map and metric semantics.
- **Do** align search width with the floating panel column so chrome reads as one vertical instrument.

### Don't:
- **Don't** build Dashboards SaaS genéricos (metric walls, multi-card grids, sidebar app chrome as the brand).
- **Don't** use púrpuras/glow “AI”, neon accents, or glassmorphism.
- **Don't** ship cards decorativas sin acción — every card/panel block must advance or explain the workflow.
- **Don't** add hero-métricas de marketing to the first viewport or panel header.
- **Don't** introduce tipografía display ruidosa or a second display family; stay on the product scale (~21px titles).
- **Don't** round primary buttons or nav tabs; `rounded-none` is mandatory for CTAs.
- **Don't** invent a dark mode or purple-on-white theme — light ink/paper is the system.
