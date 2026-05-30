# Interlace — apex landing site

The Interlace ecosystem's apex landing site at [interlace.tools](https://interlace.tools). Explains what Interlace is, the cruise-control / sibling-repos topology, the evidence-backed claims contract — and serves as a directory that redirects visitors to each product subdomain.

This site is the third consumer of [`@interlace/docs-baseline`](../../interlace/docs-baseline/) (after `eslint/apps/docs` and `serverless/apps/docs`). Brand, layout, validators, and Fumadocs config all come from the baseline; this repo owns content and the home-page ecosystem grid.

## Develop

```bash
npm run landing:dev    # from repo root, or:
npm run dev            # from apps/interlace-landing
```

Dev server runs at <http://localhost:3002>.

## Sync the baseline

The `.interlace/` folder is generated. Edit the source under [interlace/docs-baseline/](../../interlace/docs-baseline/), then:

```bash
npm run docs-baseline:sync         # lay down updated .interlace/
npm run docs-baseline:sync:check   # exit 1 on drift
```

See [interlace/docs-baseline/README.md](../../interlace/docs-baseline/README.md) for the full canonical layout, brand tokens, and consumer-onboarding flow.

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
