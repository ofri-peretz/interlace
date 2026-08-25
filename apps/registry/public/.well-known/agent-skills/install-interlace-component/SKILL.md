---
name: install-interlace-component
description: Install a component from the Interlace registry into a project with the shadcn CLI, including the CSS baseline it assumes and the dependency graph the CLI walks. Use when a component has been chosen and needs to land in a repo.
license: MIT
---

# Install an Interlace component

## The command

```bash
npx shadcn@latest add https://ds.interlace.tools/r/<name>.json
```

Always the absolute URL in generated instructions. A **bare name** (`shadcn add
button`) resolves against ui.shadcn.com and installs somebody else's component;
the `@interlace/<name>` short form only resolves for a project that already
registered the namespace in `components.json`:

```json
{ "registries": { "@interlace": "https://ds.interlace.tools/r/{name}.json" } }
```

## Prerequisites

1. A shadcn-initialised project (`components.json` present, Tailwind CSS v4).
2. The CSS baseline: `npx shadcn@latest add https://ds.interlace.tools/r/theme.json`.
   Every component assumes its tokens, the WCAG 2.2 SC 2.4.13 focus ring, and
   the `[data-min-viewport]` container contract. The CLI pulls it as a registry
   dependency of any component, so a normal install gets it — install it first
   only when starting from bare.

## What actually lands

Each item's `installsTo` (in `https://ds.interlace.tools/data/agent-index.json`) lists the
exact target paths. Items are **copied**, not linked: after install the files are
the consumer's. Each carries a generated banner with its version and a link to
`https://ds.interlace.tools/c/<name>#history` — leave the banner in place, it is the only
thing an upgrade diff can read.

132 item(s) declare more than one registry dependency; the CLI
walks that graph transitively, so installing one pattern can write several files.

## Starter bundles

One install for a whole contract instead of a list of names:

- `npx shadcn@latest add https://ds.interlace.tools/r/a11y-starter.json` — A11y Starter: @interlace/ui — the three a11y primitives + the reduced-motion hook every consumer should install on day one.
- `npx shadcn@latest add https://ds.interlace.tools/r/layout-starter.json` — Layout Starter: @interlace/ui — the six layout primitives that compose every page. One install, the LAYOUT_PHILOSOPHY contract is satisfied.
- `npx shadcn@latest add https://ds.interlace.tools/r/mdx-starter.json` — MDX Starter: @interlace/ui — the components most MDX pipelines need (Callout, Prose, CodeBlock, Tag), wired through a default mdx-components.tsx.

## Verify

```bash
# the item exists and is well-formed before you shell out to the CLI
curl -sfL https://ds.interlace.tools/r/<name>.json | jq '.name, .type, .meta'
```

A 404 means the name is wrong — list the real ones from
`https://ds.interlace.tools/r/registry.json`. Do not guess a name from a screenshot.

## Deprecations

An item may carry `meta.deprecated` with `removedIn` and `replacement`. Install
the replacement instead, and say why.

Nothing in the catalogue is deprecated right now.
