# The fumadocs bridge — a first-class contract

The Interlace DS ships into two kinds of app:

- **plain React / Next sites** (marketing, blog, dashboards), and
- **fumadocs docs sites** (`apps/landing`, the ESLint docs, serverless docs).

Both get the **same** components. This document is the contract that makes
that possible, and the rules that keep it true.

> **One sentence:** `packages/ui/styles/theme.css` is the only seam between
> the DS and fumadocs — DS components never import `fumadocs-ui`, and
> fumadocs pages consume DS components through the bridge tokens.

Enforced by `packages/ui/__tests__/fumadocs-bridge-lock.test.ts`.

---

## Why a bridge at all

Our components are styled against the bare shadcn token names —
`bg-card`, `text-muted-foreground`, `border-border`, `ring-ring`. Fumadocs
styles itself against its own namespaced family, `--color-fd-*`, and does
**not** define the unprefixed names.

Drop a DS `<Card>` into a fumadocs page with no bridge and every one of
those utilities resolves to an undefined custom property: transparent
dropdowns, invisible borders, unreadable popovers.

The bridge is one file of aliases:

```css
/* packages/ui/styles/theme.css */
@layer interlace.bridge {
  :root {
    --background: var(--color-fd-background);
    --card:       var(--color-fd-card);
    --border:     var(--color-fd-border);
    /* …the full surface set… */
  }
}
```

Inside a fumadocs app, `bg-card` now resolves to whatever fumadocs' theme
says a card is. Outside one, `interlace-theme.css` (a later cascade layer)
binds the same names to the Interlace brand values, and the bridge simply
falls away. **One component, two hosts, zero conditionals.**

The layer wrap is load-bearing: unlayered `:root` declarations beat every
layered one per the CSS Cascade Layers spec, so an unwrapped bridge would
trump the brand bindings instead of deferring to them. See
`DESIGN_SYSTEM_LAYERS.md` § "CSS Cascade Layers".

---

## The rules

### 1. DS components never import `fumadocs-ui`

`fumadocs-ui` is a *UI layer* — it competes with ours. A DS component that
imports it drags a docs framework (and its CSS assumptions) into every
consumer, including the ones that will never render a doc page.

The relationship is one-directional: **fumadocs pages consume DS
components; DS components know nothing about fumadocs.**

### 2. DS components never style with `*-fd-*` classes

`bg-fd-card` renders unstyled anywhere fumadocs' CSS isn't loaded. Use the
bare token — `bg-card` — and let the bridge map it inside docs apps. This
is the whole point of the bridge; a component that reaches for `fd-`
tokens has bypassed the seam and silently hard-coded a host requirement.

*(Phase 1.4 removed 37 such classes from 12 files — `Section`,
`ArticleCard`, the magicui/aceternity effects. They were invisible bugs:
correct in `apps/landing`, broken in any non-docs consumer.)*

### 3. `src/fumadocs/` is the only adapter surface

One directory may talk to fumadocs directly:

```
packages/ui/src/fumadocs/
  remote-markdown.tsx           ← AnchorProvider + TableOfContents
  remote-markdown-skeleton.tsx
  remote-source-callout.tsx
  edit-on-github.tsx
```

**Allowed imports — the complete list:**

| Specifier | Why it's safe |
|---|---|
| `fumadocs-core/toc` | Headless TOC anchors + the `TableOfContents` type. Behavior and data, no chrome. |

`fumadocs-core/*` is headless: behavior and types with no styling opinion,
which is exactly what makes it safe to borrow. `fumadocs-ui/*` is banned
here too — the adapter is not an escape hatch.

Adding an entrypoint is a deliberate act: extend
`ALLOWED_FUMADOCS_IMPORTS` in the lock test **and** add a row to the table
above, in the PR that needs it.

### 4. `theme.css` is the only stylesheet that reads `--color-fd-*`

Reading a fumadocs token is bridging — that's this file's job. Other
stylesheets may *write* `--color-fd-*` (pushing a brand value into
fumadocs' own surface, as `interlace-theme.css` does for
`--color-fd-muted-foreground` to hit AAA contrast), but never read.

---

## Consumer contract

### A fumadocs docs app

```css
/* app/global.css */
@import "tailwindcss";
@import "fumadocs-ui/css/neutral.css";   /* fumadocs first — it's the host */
@import "fumadocs-ui/css/preset.css";
@import "@interlace/ui/styles/index.css"; /* bridge + brand ride on top */
```

Import order matters: the bridge aliases `--color-fd-*`, so those variables
must already exist. The app keeps using fumadocs' layouts and page
components; DS primitives, patterns, and templates drop in anywhere inside
them and inherit the docs theme automatically.

### A non-fumadocs app

```css
/* app/global.css */
@import "tailwindcss";
@import "@interlace/ui/styles/index.css";
```

The bridge layer resolves to nothing (no `--color-fd-*` defined) and
`interlace.brand` + `interlace.semantics` supply every token. Nothing to
strip, no fumadocs dependency in the tree.

### Via the shadcn registry

`npx shadcn add @interlace/<item>` pulls the same stylesheets — the
registry build copies `styles/*.css` verbatim to
`ds.interlace.tools/r/styles/`, with a drift check in CI
(`apps/registry/scripts/build-registry.mjs`). Registry consumers get the
identical bridge, not a fork of it.

---

## What the lock test enforces

`packages/ui/__tests__/fumadocs-bridge-lock.test.ts`:

| Assertion | Rule |
|---|---|
| No `fumadocs-ui` import anywhere under `src/` | 1 |
| Only `src/fumadocs/` imports the `fumadocs*` namespace, and only from `ALLOWED_FUMADOCS_IMPORTS` | 3 |
| No `*-fd-*` utility class in any component source | 2 |
| `theme.css` wraps its aliases in `@layer interlace.bridge` | cascade |
| `theme.css` bridges the load-bearing surface tokens | bridge integrity |
| No other stylesheet reads `var(--color-fd-*)` | 4 |

The failure mode all six catch is the same one: a change that works in
`apps/landing` (fumadocs is loaded there) and is broken everywhere else —
discovered by whoever adopts the DS next, not by us.
