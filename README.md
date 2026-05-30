# Interlace

The Interlace community: design system, Storybook, and the **interlace.tools** landing page. A turborepo monorepo.

> **Public** — installing primitives, theming a fork, or contributing a primitive should all be one-command jobs. The design system source IS the documentation.

---

## What lives here

| Path | URL | Purpose |
|---|---|---|
| [`packages/ui/`](./packages/ui/) | (npm: `@interlace/ui`) | Design-system primitives, blocks, and tokens. Each primitive is server-component-safe where it can be, declares a minimum viewport, and obeys the R1–R26 component-modeling floor. |
| [`apps/storybook/`](./apps/storybook/) | **[storybook.interlace.tools](https://storybook.interlace.tools)** | Visual contract surface — every primitive + block + foundation specimen. axe + dark-mode + RTL run in CI against every story. |
| [`apps/landing/`](./apps/landing/) | **[interlace.tools](https://interlace.tools)** | Community landing page. |
| [`docs/philosophies/`](./docs/philosophies/) | — | The 25 `*_PHILOSOPHY.md` source-of-truth charters — typography / layout / color / motion / a11y / keyboard / loading / forms / etc. |
| [`DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md) | — | The 14-principle look-and-feel charter that governs every surface. |

The **registry storefront** (per-component install pages, browsable at `ds.interlace.tools`) lives in the [`ofri-peretz/eslint`](https://github.com/ofri-peretz/eslint) monorepo. It will move here in a follow-up.

---

## Quick start

```bash
git clone git@github.com:ofri-peretz/interlace.git
cd interlace
npm install
npm run dev          # turbo run dev — boots every workspace in parallel
```

Per-app:

```bash
npm run dev   -w apps/storybook   # storybook dev server on :6006
npm run dev   -w apps/landing     # next dev for interlace.tools
npm run build -w packages/ui      # build the primitives for publish
```

---

## Installing a primitive in your own project

The DS ships as a [shadcn registry](https://ui.shadcn.com/docs/registry). Pick the URL from [ds.interlace.tools](https://ds.interlace.tools) or use the `@interlace` alias:

```bash
npx shadcn@latest add @interlace/button
# or, by URL
npx shadcn@latest add https://ds.interlace.tools/r/button.json
```

The file lands in your repo (`src/components/ui/button.tsx`) — own it, mod it, blame it. No bundle, no black box.

---

## Contributing

Read [`DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md) before adding a primitive — the 14 principles are the spec.

```bash
# A new primitive lands as four pieces, in one PR:
# 1. packages/ui/src/primitives/<name>.tsx     (the primitive)
# 2. apps/storybook/src/stories/primitives/<Pascal>.stories.tsx
# 3. apps/docs/src/__tests__/primitives-min-viewport-lock.test.tsx  (append to PRIMITIVES)
# 4. packages/ui/package.json                  (the export entry)
```

CI gates on every PR:

- `turbo run typecheck` — every workspace
- `turbo run test` — vitest + the three lock tests (min-viewport, layout-primitives, storybook-coverage)
- `turbo run build` — Storybook static + Landing next-build + UI dist
- a11y — `@storybook/test-runner` + axe against every story

---

## License

[MIT](./LICENSE) — drop the primitives into proprietary or open codebases alike. Brand fork by editing only the `--interlace-*` token layer.
