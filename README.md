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
| [`apps/registry/`](./apps/registry/) | **[ds.interlace.tools](https://ds.interlace.tools)** | The shadcn registry: `/r/<name>.json` items, per-component pages, changelog, and the agent index. |
| [`packages/cli/`](./packages/cli/) | (npm: `interlace-ui`) | A thin front door over the shadcn CLI that adds `list` and `info`. |
| [`docs/philosophies/`](./docs/philosophies/) | — | The 27 `*_PHILOSOPHY.md` source-of-truth charters — typography / layout / color / motion / a11y / keyboard / loading / forms / etc. Projected into Storybook by `npm run sync:philosophies`; never edit the generated `apps/storybook/src/stories/philosophy/*.mdx` by hand. |
| [`DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md) | — | The 14-principle look-and-feel charter that governs every surface. |

## What Interlace does differently

Interlace is a shadcn registry, so it starts where shadcn does: you install source, not a package, and the file is yours. What it adds is a set of commitments, each one checked by a test rather than promised in prose.

- **Themed by CSS variables, in four layers.** A brand file sets the palette, a semantics file gives the colours their jobs (`--primary`, `--scrim`, `--highlight`), a structure layer owns type, radius, layout and motion, and a page layer sets the defaults for a document. Each lives in its own cascade layer, so restyling a site means changing a few variables in one file, not overriding classes in many.
- **No custom classes needed.** Components cover the cases a real site meets through props, variants and composition. A phone menu is `mobileNav`, a full-width prose column is `width="fill"`, an animated button is a `Button` with a `<Sheen />` inside. If you find yourself writing a `className` to get something ordinary, that is a gap in Interlace, and we want to hear about it.
- **Composition over configuration.** Compound components (`ClaimCard.Claim`, `FocusGrid.Item`) and slots let you arrange the parts yourself, while each part keeps its semantics and its accessibility wiring.
- **Accessible by construction.** Semantics come from native elements first. Colour contrast is computed from the tokens in both schemes, so a palette change that breaks AA fails a test before anyone sees it. Every story runs through axe in light, dark and right-to-left.
- **Motion that respects people.** Every animation stops under `prefers-reduced-motion`, decoration is hidden from assistive tech and from the pointer, anything that moves for long has a visible pause control, and animations sleep when they are off screen. The effects need no keyframes in your stylesheet.
- **Server first.** A component that needs no browser state is a server component. Content that animates still renders in full on the server, so readers without scripts, crawlers and screen readers get the real text and the real numbers.
- **Patterns for content, not only for apps.** Alongside the usual controls, Interlace ships the pieces that sites built around reading need: claims with their sources, citations, both sides of a question side by side, dialogue, stances, and site chrome that works on a phone.
- **Readable by agents.** The registry publishes `llms.txt` and a machine-readable index of every component's props, keyboard path, server boundary and minimum viewport, so an assistant can choose a component instead of guessing.
- **Our own work.** We learn from the wider ecosystem, and we write our own code. Every component in this registry is original to Interlace.

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
npm run dev   -w apps/registry    # next dev for ds.interlace.tools on :4178
npm run build -w packages/ui      # build the primitives for publish
```

---

## Installing a primitive in your own project

The DS ships as a [shadcn registry](https://ui.shadcn.com/docs/registry). Pick the URL from [ds.interlace.tools](https://ds.interlace.tools) or use the `@interlace` alias:

```bash
npx interlace-ui add button
# or with the shadcn CLI, by alias or by URL
npx shadcn@latest add @interlace/button
npx shadcn@latest add https://ds.interlace.tools/r/button.json
```

[`interlace-ui`](./packages/cli) is a thin front door over the shadcn CLI — it
delegates every install, and adds `list` / `info`, which the shadcn CLI has no
command for. `npx interlace-ui init` registers the `@interlace` alias so the
plain shadcn commands above keep working with or without it.

The file lands in your repo (`src/components/ui/button.tsx`) — own it, mod it, blame it. No bundle, no black box.

---

## Contributing

Read [`DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md) before adding a primitive — the 14 principles are the spec.

```bash
# A new primitive lands as five pieces, in one PR:
# 1. packages/ui/src/primitives/<name>.tsx     (the primitive)
# 2. apps/storybook/src/stories/primitives/<Pascal>.stories.tsx
# 3. packages/ui/__tests__/primitives-min-viewport-lock.test.tsx  (append to PRIMITIVES)
# 4. packages/ui/package.json                  (the export entry)
# 5. apps/registry/registry-categories.json    (its category)
```

Then rebuild the registry (`npm run registry:build`) and add a changeset (`npm run changeset`).
The full checklist is in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

CI gates on every PR:

- `turbo run typecheck` — every workspace
- `turbo run test` — vitest unit tests plus the lock tests that turn the design rules into checks
- registry — items match their sources, validate against the official shadcn schemas, and every item installs into a scratch Next.js app
- `turbo run build` — Storybook static + Landing next-build + UI dist
- a11y — `@storybook/test-runner` + axe against every story
- visual — Playwright snapshot baselines for the kit

---

## License

[MIT](./LICENSE) — drop the primitives into proprietary or open codebases alike. Brand fork by editing only the `--interlace-*` token layer.
