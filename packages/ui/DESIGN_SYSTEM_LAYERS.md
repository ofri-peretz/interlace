# Interlace DS — the 5-layer architecture

This document is the canonical contract for **how the Interlace design
system is organized**. Every primitive, pattern, template, ESLint rule,
lock test, and consumer-facing CSS import lives somewhere in this 5-layer
model. If you're authoring a new component, a new CSS token, or a new
docs page, **start here**.

Sibling docs that drill into specific layers:

- `STYLES.md` (canonical CSS import order, this doc summarizes)
- `TYPOGRAPHY_PHILOSOPHY.md` (foundation layer — type scale)
- `LAYOUT_PHILOSOPHY.md` (foundation layer — spacing scale)
- `COLOR_PHILOSOPHY.md` (brand layer — semantic-token table)
- `MOTION_PHILOSOPHY.md` (primitives layer — animation tokens)

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
#6d28d9`, etc.).

**Files:**

- `packages/ui/styles/tokens.css` — animations + motion tokens, wrapped
  in `@layer interlace.primitives`.
- `packages/ui/styles/foundation.css` — type scale, spacing, radius,
  container widths, font families (registered as Tailwind `@theme`
  tokens; `@theme` directives stay top-level).
- `packages/ui/styles/interlace-theme.css` — brand hex literals
  (`--interlace-*: #hex`), light + dark, wrapped in `@layer interlace.brand`.

**Cascade layer name(s):** `interlace.primitives`, `interlace.foundation`,
`interlace.brand`.

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

- `packages/ui/styles/theme.css` — fumadocs bridge:
  `:root { --background: var(--color-fd-background); ... }`. Wrapped in
  `@layer interlace.bridge`.
- `packages/ui/styles/interlace-theme.css` (the second half) — brand
  bindings: `:root { --background: var(--interlace-background); ... }`.
  Wrapped in `@layer interlace.semantics`.

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

---

## Layer 3 — Components (React primitives)

**What lives here:** atomic React components. Each is a single
responsibility, single file, governed by the R1–R26 component API rules
(see `eslint-plugin-react-features/docs/rules/component-api/*`).

**Files:** `packages/ui/src/primitives/*.tsx` (42 today).

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

See `packages/ui/src/templates/README.md` for the per-template contract.

---

## CSS Cascade Layers — the override story

The DS declares its layer order in **`packages/ui/styles/index.css`**:

```css
@layer interlace.primitives, interlace.foundation, interlace.preflight,
       interlace.bridge, interlace.brand, interlace.semantics;

@import "./tokens.css";
@import "./foundation.css";
@import "./preflight.css";
@import "./theme.css";
@import "./interlace-theme.css";
```

The declared order is the **cascade order** — later layers win when two
layers set the same property.

**Consumer override pattern:**

```css
/* consumer's global.css */
@import "tailwindcss";
@import "@interlace/ui/styles/index.css";   /* full DS contract */

/* Fork the brand: re-declare interlace.brand AFTER the import.
 * Your declarations land in the same layer, but later source order
 * wins WITHIN a layer. Or declare a higher layer name (e.g.
 * @layer my-brand;) for an unambiguous override. */
@layer interlace.brand {
  :root {
    --interlace-primary: oklch(0.55 0.22 264);    /* your blue */
    --interlace-primary-hover: oklch(0.50 0.22 264);
    /* … */
  }
}
```

Without cascade layers, brand override = source-order roulette. With
them, the override surface is named, documented, and deterministic.

**What's INTENTIONALLY unlayered:**

- Tailwind v4 `@theme { ... }` blocks in `foundation.css` and
  `interlace-theme.css` (Tailwind processes them globally — wrapping
  breaks utility generation).
- Shiki AAA overrides in `theme.css` (they need higher cascade weight
  than inline `style="--shiki-light: #…"` declarations to win).
- Component-specific styles inside a primitive's CVA (governed by the
  primitive's own contract, not the DS-wide layer model).

---

## The CSS import contract

For a consumer app, **one line** gives the full DS baseline:

```css
@import "tailwindcss";
@import "@interlace/ui/styles/index.css";
```

That single import resolves to (in cascade order):

1. `tokens.css` — keyframes, animation utilities → `@layer interlace.primitives`
2. `foundation.css` — type/spacing/radius `@theme` tokens (top-level for Tailwind)
3. `preflight.css` — body bg/fg/font, focus ring, scrollbar, min-viewport → `@layer interlace.preflight`
4. `theme.css` — fumadocs bridge `:root { --background: var(--color-fd-*) }` → `@layer interlace.bridge`
5. `interlace-theme.css` — brand hex literals + alias bindings → `@layer interlace.brand` + `@layer interlace.semantics`

A consumer who already had the long-form chain
(`@import "@interlace/ui/styles/tokens.css"` … 5 lines) continues to
work — the individual files still export — but new code should use the
barrel.

---

## Lint + lock enforcement

| Layer | Enforcement |
|---|---|
| 1 (Primitives) | `no-raw-color-literal` (ESLint) blocks raw hex outside `@interlace/ui/styles/interlace-theme.css`. |
| 2 (Semantics) | (no automated check yet) — manual review during PR. |
| 3 (Components) | R1–R26 via `componentApi` ESLint preset (8 rules). |
| 4 (Patterns) | Lives under `patterns/`; old `blocks/` aliases marked `@deprecated`. |
| 5 (Templates) | `templates-section-boundary-lock.test.ts` (planned) asserts every template composes `<SectionBoundary>`. |
| **State (Skeleton variant)** | `skeleton-variant-coverage-lock.test.ts` (planned) asserts every component name has a matching Skeleton variant. TypeScript catches at dev. |
