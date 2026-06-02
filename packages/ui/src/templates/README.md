# `@interlace/ui/templates`

The **templates** layer of the Interlace DS — full-page surfaces that
compose primitives and patterns into a complete UX for a specific page
type (article, registry-item, auth flow, dashboard, error/404).

## Contract

A template:

1. **Is a full page**, not a section. If your component renders inside a
   page, it's a primitive or a pattern, not a template.
2. **Composes patterns + primitives only** — no direct DOM, no inline
   styles, no raw token literals (R18 / R19 inherit from the primitive
   contract).
3. **Streams section-by-section** — every independently-loadable region
   is wrapped in `<SectionBoundary name="…">` so the header can paint
   while the body is still fetching, and each section gets its own
   skeleton + error fallback.
4. **Ships its own skeleton variant** — `<XTemplate.Skeleton />` (or a
   default state via the unified `<Skeleton variant="x-template" />`)
   renders the full-page loading layout, not a single rect.
5. **Carries `MIN_VIEWPORT`** and a `data-min-viewport` attribute on the
   root, like every primitive.
6. **Has a Storybook story** under `apps/storybook/src/stories/templates/`
   with Default / Loading (all SectionBoundaries pending) / Error /
   Empty / Dark / RTL variants.
7. **Has a registry item** so consumers can `npx shadcn add @interlace/<template-name>`.

## File layout

```
packages/ui/src/templates/
  README.md            ← this file
  article-template.tsx
  registry-item-template.tsx
  …
```

## Layer order in the DS taxonomy

```
Primitives (CSS vars)   — interlace.primitives / interlace.foundation
Semantics  (CSS vars)   — interlace.semantics  / interlace.brand
Components (R1–R26)     — packages/ui/src/primitives/*.tsx
Patterns   (composites) — packages/ui/src/patterns/*.tsx
Templates  (full pages) — packages/ui/src/templates/*.tsx   ← YOU ARE HERE
```

See `packages/ui/DESIGN_SYSTEM_LAYERS.md` for the canonical layer
contract.

## Adding a new template

1. Identify the page type. If it doesn't compose ≥3 patterns or doesn't
   represent a full UX flow, it's a pattern, not a template.
2. Decide the streaming boundaries: each independently-loading region
   becomes its own `<SectionBoundary>`.
3. Implement `<XTemplate>` in `templates/x-template.tsx`. Follow R-rules
   inherited from the primitive contract.
4. Add a story under `apps/storybook/src/stories/templates/XTemplate.stories.tsx`
   with the 6 required variants (see contract #6).
5. The registry build script auto-discovers the file — no manual JSON
   edit needed.
6. Append the template name + viewport to
   `packages/ui/__tests__/primitives-min-viewport-lock.test.tsx`.
