# Interlace — apex landing site

The Interlace ecosystem's apex landing site at [interlace.tools](https://interlace.tools). Explains what Interlace is, the cruise-control / sibling-repos topology, the evidence-backed claims contract — and serves as a directory that redirects visitors to each product subdomain.

This site is the third consumer of [`@interlace/docs-baseline`](../../interlace/docs-baseline/) (after `eslint/apps/docs` and `serverless/apps/docs`). Brand, layout, validators, and Fumadocs config all come from the baseline; this repo owns content and the home-page ecosystem grid.

## Develop

```bash
npm run landing:dev    # from repo root, or:
npm run dev            # from apps/interlace-landing
```

Dev server runs at <http://localhost:3002>.

## The `.interlace/` folder

**It is an orphaned snapshot. Edit it in place — nothing syncs it.**

The banners inside say "DO NOT EDIT — edit the docs-baseline source and re-run
`npm run docs-baseline:sync`". That generator is real and still runs, but it
does not write here. Its target list
(`agents/interlace/docs-baseline/interlace.targets.json`) has four entries —
`eslint/apps/docs`, `serverless/apps/docs`, and the agents repo's own
`apps/interlace-landing` and `apps/blog` — and this app is not one of them.
It was seeded from that baseline once and has been independent since
(2026-05-29). There is no `docs-baseline:sync` script in this app's
`package.json` because the script lives at the agents repo root, not here.

Three things worth knowing before you touch it:

- **Edits here are durable.** No sync will clobber them. The banners are wrong
  about that and are being corrected file by file as they get touched.
- **It has drifted from the design system.** `.interlace/components/ui/` is a
  snapshot of `packages/ui/src/primitives/`, and `button-variants.ts` was two
  a11y fixes behind when that drift was found. Diff against the DS before
  trusting a file here, and fix the DS first so the change is the one under
  test — `packages/ui/__tests__/composite-contrast-lock.test.ts` guards the DS
  copy and nothing guards this one.
- **Most of it is unused.** Of 54 components under `.interlace/components/ui/`,
  this app imports three (`button-variants`, `skeleton`, `number-ticker`) plus
  a handful of decorative ones. The rest is dead weight that still shows up in
  greps and audits.

## Content layout

- `content/docs/index.mdx` — Landing-style overview ("What is Interlace")
- `content/docs/concepts/` — Explanation of the ecosystem (Diátaxis: explanation)
- `content/docs/reference/landscape.mdx` — Cross-product evidence comparison (per [evidence-framework.md](../../interlace/evidence-framework.md))

## Adding components on demand

`components.json` declares multiple shadcn registries — pull marketing/landing components as needed:

```bash
npx shadcn@latest add button                       # shadcn official (Base UI variant)
npx shadcn@latest add @magicui/marquee             # MagicUI
npx shadcn@latest add @aceternity/spotlight        # Aceternity
npx shadcn@latest add @originui/feature-grid       # Origin UI
```

Site-local components land under `src/components/`. The synced shared pool lives at `.interlace/components/`.
