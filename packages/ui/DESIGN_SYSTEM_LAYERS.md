# Interlace DS — the 5-layer architecture

This document is the canonical contract for **how the Interlace design
system is organized**. Every primitive, pattern, template, ESLint rule,
lock test, and consumer-facing CSS import lives somewhere in this 5-layer
model. If you're authoring a new component, a new CSS token, or a new
docs page, **start here**.

Sibling docs that drill into specific layers:

In this package:

- `FUMADOCS_BRIDGE.md` (layer-2 seam — the ONLY coupling between the DS
  and fumadocs; read before touching `page/fumadocs.css` or `src/fumadocs/`)
- `CONVENTIONS.md` (authoring rules: file structure, naming, headers)

The canonical CSS import order is "The CSS import contract" below, and
`styles/index.css` is its executable form. (There is no `STYLES.md` —
earlier revisions of this list pointed at one that was never written.)

In `docs/philosophies/`, at the repo root:

- `../../docs/philosophies/BREAKPOINT_PHILOSOPHY.md` (foundation layer — the 4-tier `--breakpoint-*` ladder, and why there is no `2xl`)
- `../../docs/philosophies/TYPOGRAPHY_PHILOSOPHY.md` (foundation layer — type scale)
- `../../docs/philosophies/LAYOUT_PHILOSOPHY.md` (foundation layer — spacing scale)
- `../../docs/philosophies/COLOR_PHILOSOPHY.md` (brand layer — semantic-token table)
- `../../docs/philosophies/MOTION_PHILOSOPHY.md` (primitives layer — the motion budget)

---

## The 5 layers

```
┌─────────────────────────────────────────────────────────────────┐
│  5. Templates    full pages — ArticleTemplate, AuthTemplate     │
│                  (composes 3+ patterns; streams per section)    │
├─────────────────────────────────────────────────────────────────┤
│  4. Patterns     composites — AuthorByline, NewsletterForm,     │
│                  PrevNextPost (composes 2+ components)          │
├─────────────────────────────────────────────────────────────────┤
│  3. Components   atomic React primitives — Button, Input, Card  │
│                  Skeleton, Dialog, … (R1–R26 contract)          │
├─────────────────────────────────────────────────────────────────┤
│  2. Semantics    --background, --foreground, --muted-foreground │
│                  --primary, --ring, --destructive (CSS vars)    │
│                  → references the brand layer via var(...)      │
├─────────────────────────────────────────────────────────────────┤
│  1. Primitives   raw values — hex, px, keyframes, motion        │
│                  (animations + foundation + brand hex literals) │
└─────────────────────────────────────────────────────────────────┘
```

Layers 1 + 2 are CSS. Layers 3, 4, 5 are React.

Each layer **only references the layer beneath it**, never above. A
component (3) references a semantic token (2). A semantic token (2)
resolves to a brand primitive (1). A pattern (4) composes components (3).
A template (5) composes patterns (4) and components (3).

**Why this layering matters.** It keeps the override surface
predictable: a consumer who wants to fork the brand only touches layer 1
(brand hex literals), and every higher layer flows through automatically
because they reference *down* via `var(--…)` and React imports — never
up. Same logic in reverse: a template that wants a different layout
composes different patterns; it doesn't reach into a primitive's
internals.

---

## Layer 1 — Primitives (CSS)

**What lives here:** raw value tokens — keyframes, animation timings,
font families, the type/spacing/radius scales registered as Tailwind
theme tokens, and the concrete brand hex literals (`--interlace-primary:
#7d350c`, etc.).

**Files:**

- `packages/ui/styles/brand/interlace.css`, `brand/harbor.css` — brand
  literals (`--interlace-*`), light + dark, one file per theme, wrapped in
  `@layer interlace.brand`.
- `packages/ui/styles/structure/type.css`, `layout.css`, `radius.css`,
  `motion.css` — the brand-invariant scales (type, containers + `xs`
  breakpoint, radius steps, keyframes + timings), registered as Tailwind
  `@theme` tokens. Their classes (prose, animations) sit in Tailwind's
  `components` layer.

**Cascade layer name(s):** `interlace.brand`; structure uses Tailwind's own
`@theme` and `components`.

**Rule:** Never reference a semantic (layer 2) token from here. Layer 1
is the *source*; everything else flows down from it.

---

## Layer 2 — Semantics (CSS)

**What lives here:** the semantic alias graph — `--background` →
`var(--interlace-background)`, `--foreground` →
`var(--interlace-foreground)`, `--muted-foreground` →
`var(--interlace-muted-foreground)`, etc. Plus the Tailwind v4
`@theme inline { --color-* }` registration that wires the semantic vars
to utility classes (`bg-background`, `text-foreground`, …).

**Files:**

- `packages/ui/styles/semantics.css` — the bindings:
  `:root { --background: var(--interlace-background); ... }`, wrapped in
  `@layer interlace.semantics`, plus the `@theme inline` registration.
- `packages/ui/styles/page/fumadocs.css` (opt-in) — fumadocs bridge:
  `:root { --background: var(--color-fd-background); ... }`, wrapped in
  `@layer interlace.bridge`.

**Cascade layer name(s):** `interlace.bridge`, `interlace.semantics`.

**Rule:** Never declare a raw hex / px / keyframe here. Layer 2 is alias
mapping; the values live in layer 1.

**Why two layers (`bridge` + `semantics`):** when a consumer uses the DS
inside fumadocs, the bridge layer translates fumadocs's `--color-fd-*`
into our `--*` surface so primitives styled against `--background` work
unchanged. The semantics layer then overrides the bridge for our brand
("we don't want fumadocs colors, we want Interlace colors"). Without the
bridge layer, the DS would only work outside fumadocs; without the
semantics layer, the brand wouldn't override.

**The bridge is the ONLY seam with fumadocs** — a first-class contract
documented in `FUMADOCS_BRIDGE.md` and locked by
`__tests__/fumadocs-bridge-lock.test.ts`. In short: DS components never
import `fumadocs-ui` and never style with `*-fd-*` classes (they'd render
unstyled outside a docs app); `src/fumadocs/` is the one adapter
directory, allowed only the headless `fumadocs-core/*` entrypoints
enumerated in that doc; fumadocs pages consume DS components through the
bridge tokens. Read it before touching `page/fumadocs.css` or `src/fumadocs/`.

---

## Layer 3 — Components (React primitives)

**What lives here:** atomic React components. Each is a single
responsibility, single file, governed by the R1–R26 component API rules
(see `eslint-plugin-react-features/docs/rules/component-api/*`).

**Files:** `packages/ui/src/primitives/*.tsx` (56 at time of writing —
re-derive with `ls packages/ui/src/primitives/*.tsx | wc -l` rather
than trusting this number; no test guards it).

**Rule:** Never reference a layer-1 token directly (no hex literals in
`className` or `style`, enforced by `no-raw-color-literal`). Always go
through layer 2 (semantic Tailwind utilities: `bg-background`,
`text-muted-foreground`, etc.).

**State contract** (uniform across components that own data):

- `idle` — default render
- `loading` — `<Skeleton variant="<own-name>" />` (via `loading?:
  boolean` prop)
- `error` — `<ErrorState tone="danger" />` (via `<DataState>` orchestrator)
- `empty` — `<EmptyState />` (via `<DataState>` orchestrator)

The `loading` prop is a uniform API across every data-owning primitive.
The Skeleton primitive's `variant` union mirrors the set of components
exactly — enforced by both TypeScript and a vitest lock test
(`skeleton-variant-coverage-lock.test.ts`).

---

## Layer 4 — Patterns

**What lives here:** composites that compose ≥2 layer-3 components and
solve a recurring UX need but aren't full pages — AuthorByline
(Avatar + Typography + Date), NewsletterForm (Input + Button +
Checkbox + Label), PrevNextPost (Link + ArticleCard ×2),
ShareButtons (Button ×N).

**Files:** `packages/ui/src/patterns/*.tsx` (was `blocks/` —
renamed in Phase 1 of the 5-layer architecture PR; `blocks/` paths
remain as deprecated re-export aliases for one release cycle).

**Rule:** Never bypass a primitive to reach a layer-2 token. If a
pattern needs a non-existent primitive, ship the primitive first
(layer 3), then the pattern.

---

## Layer 5 — Templates

**What lives here:** full-page surfaces composed from patterns +
primitives. ArticleTemplate (header + prose + related + share),
RegistryItemTemplate (header + anatomy + variants + install),
AuthTemplate (signin / signup / reset), ErrorTemplate (404 / 500).

**Files:** `packages/ui/src/templates/*.tsx`.

**Rule:** Every independently-loadable region MUST be wrapped in
`<SectionBoundary name="…">` so the page streams section-by-section.
A template that renders all-or-nothing is a regression — wrap it.

**Rule:** Every template ships a page-level loading state as a
`<XTemplate.Skeleton />` static — the full-page silhouette composed from
`<Skeleton variant>` shapes, not a single rect. It's what a consumer's
`loading.tsx` renders, and what keeps the first paint CLS-neutral (R23).
One `role="status"` region per page; inner skeletons pass `label={null}`
so screen readers hear one announcement, not ten.

See `packages/ui/src/templates/README.md` for the per-template contract.

---

## CSS Cascade Layers — the override story

The stylesheet tree is the architecture. Each directory reads only the one
before it, and `__tests__/css-layer-lock.test.ts` fails the build if one
reaches across:

```
styles/
  brand/*.css        1. raw --interlace-* values      @layer interlace.brand
  semantics.css      2. semantic names → brand values  @layer interlace.semantics
  structure/*.css    3. type, layout, radius, motion   @theme + @layer components
  page/*.css         4. opt-in page styling            @layer base + interlace.bridge
  base.css           = 1 + 2 + 3   (registry: interlace-base, ships with every component)
  index.css          = base + 4    (registry: interlace-foundation, opt-in)
```

Both barrels declare:

```css
@layer interlace.bridge, interlace.brand, interlace.semantics;
```

Tailwind has already declared `theme, base, components, utilities`, so
these three rank ABOVE utilities. That is safe only because they hold
nothing but custom properties on `:root`, `.dark`, `[data-scheme]` and
`[data-theme]`. Every rule that styles an element (preflight, prose,
animation classes) sits in Tailwind's `base` or `components` layer, so a
utility at the call site always wins. (Until 2026-11 preflight sat in a
custom `interlace.preflight` layer above utilities: `img { height: auto }`
beat `h-10`.)

**Consumer override pattern:**

```css
/* consumer's global.css */
@import "tailwindcss";
@import "@interlace/ui/styles/index.css";   /* or base.css */

/* Fork the brand: re-declare interlace.brand AFTER the import. */
@layer interlace.brand {
  :root {
    --interlace-primary: oklch(0.55 0.22 264);    /* your blue */
    --interlace-primary-hover: oklch(0.50 0.22 264);
    /* … */
  }
}
```

An unlayered `:root { --primary: … }` in the consumer's own CSS beats all
three layers, which is what a shadcn app expects.

**What's INTENTIONALLY unlayered:**

- Tailwind v4 `@theme { ... }` blocks in `structure/*.css` and
  `semantics.css` (Tailwind processes them globally — wrapping breaks
  utility generation).
- Shiki AAA overrides in `page/shiki.css` (they need higher cascade weight
  than inline `style="--shiki-light: #…"` declarations to win).
- Component-specific styles inside a primitive's CVA (governed by the
  primitive's own contract, not the DS-wide layer model).

---

## The CSS import contract

```css
@import "tailwindcss";
@import "@interlace/ui/styles/base.css";    /* additive: what components need */
/* or */
@import "@interlace/ui/styles/index.css";   /* base + fonts, preflight, fumadocs, shiki */
```

`base.css` is held to "adds, never replaces" by
`apps/registry/src/__tests__/host-style-safety.test.ts`, which compiles a
stock shadcn globals.css with and without it. Individual files are exported
under `styles/brand/*`, `styles/semantics.css`, `styles/structure/*` and
`styles/page/*`, but new code should use a barrel.

---

## Lint + lock enforcement

| Layer | Enforcement |
|---|---|
| 1 (Primitives) | `no-raw-color-literal` (ESLint) blocks raw hex outside `@interlace/ui/styles/brand/*.css`. |
| 2 (Semantics) | `fumadocs-bridge-lock.test.ts` — bridge is the only seam: no `fumadocs-ui` import, no `*-fd-*` class, `page/fumadocs.css` layered + complete, adapter allowlist. See `FUMADOCS_BRIDGE.md`. |
| 3 (Components) | R1–R26 via `componentApi` ESLint preset (8 rules). |
| 4 (Patterns) | Lives under `patterns/`; old `blocks/` aliases marked `@deprecated`. |
| 5 (Templates) | `templates-section-boundary-lock.test.ts` asserts every template composes `<SectionBoundary>` AND ships a `<X.Skeleton>` page-level loading state. |
| **State (Skeleton variant)** | `skeleton-variant-coverage-lock.test.ts` asserts every `<Skeleton variant="…">` call site resolves to a registered variant. TypeScript catches at dev. |
| **Viewport / tier** | `primitives-min-viewport-lock.test.tsx` pins `MIN_VIEWPORT` + the `'use client'` tier for every primitive AND all 13 templates. |
