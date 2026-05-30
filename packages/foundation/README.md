# @interlace/foundation

The Interlace design-system CSS baseline — distributed as plain CSS for any framework.

> **What it is.** Five stylesheets that together encode the Interlace contract: motion tokens, type / spacing / radius / container scales, the WCAG 2.2 SC 2.4.13 focus ring, the `[data-min-viewport]` container, the shadcn↔fumadocs token bridge, and the brand palette (light + dark, AAA-cleared).
>
> **What it is not.** Components. Those ship via the [Interlace shadcn registry](https://ds.interlace.tools) — copy-the-source ergonomics, install via `npx shadcn add @interlace/<name>`. This package is the CSS contract you can `npm i` without committing to vendoring component source.

## Install

```bash
npm i @interlace/foundation
```

Then `@import` either the barrel or a specific slice in your global CSS:

```css
/* full DS baseline — five stylesheets in cascade order */
@import "@interlace/foundation";

/* or just the focus + min-viewport contract */
@import "@interlace/foundation/preflight.css";
```

## What lands

| File | Carries |
|---|---|
| [`tokens.css`](./styles/tokens.css) | Motion + animation keyframes. Marquee, shimmer-slide, accordion height transitions, border-beam, fade-in / slide-in / scale-in. All gated under `prefers-reduced-motion: reduce`. |
| [`foundation.css`](./styles/foundation.css) | Type scale (`--text-h1` … `--text-caption` + `--text-long`). Six-step spacing scale (`--spacing-xs` … `-2xl`). Three-step radius scale. Container widths (`prose` / `content` / `wide` / `full`). Font tokens (Inter + JetBrains Mono). |
| [`preflight.css`](./styles/preflight.css) | Token-aware baseline that goes beyond Tailwind preflight: focus ring (WCAG 2.2 SC 2.4.13 — 2px solid, ≥3:1 contrast, 2px offset), `::selection` color, scrollbar tint, smooth-scroll respecting reduced-motion, `::placeholder` AA contrast, tabular-nums on `table`, the `[data-min-viewport]` container contract, `forced-colors` Highlight. |
| [`theme.css`](./styles/theme.css) | shadcn↔fumadocs token bridge (`--card`, `--popover`, `--foreground` → `--color-fd-*`). Shiki AAA contrast boosts for `github-light` / `github-dark`. TOC visual fix. Remote-content classes. |
| [`interlace-theme.css`](./styles/interlace-theme.css) | Brand violet palette: `violet-700` (light) → 7.34:1 AAA on white; `violet-400` (dark) → 7.42:1 AAA on near-black. Six chart-series hues. Three-step radius binding. |

The cascade order is load-bearing — keep it.

## Opting into the min-viewport dev outline

Each Interlace primitive declares its smallest viable viewport via `data-min-viewport="320|480|768"`. In development, add:

```html
<body data-interlace-dev>
```

and `preflight.css` will draw a dashed warning outline around any primitive rendered in a container narrower than its declared minimum. Strip the attribute in production.

## Versioning

`@interlace/foundation` follows semver against the CSS contract:

- **patch** — token value updates that preserve contrast + cascade behavior.
- **minor** — new tokens / utilities, additive only.
- **major** — token renames, removal, or cascade reorderings.

If a change to `packages/ui/styles/*.css` would break a consumer, it ships as a major. The lock-step with the source-of-truth is enforced via `npm run sync:check` in CI; `prepublishOnly` refuses to ship a drifted tarball.

## Why this package (and not the whole DS)?

A package-per-tier split, not per-component. The CSS contract is stable, semver-friendly, and decoupled from React component churn. We get the npm distribution pipeline live without committing to publishing 42 primitives. If a future consumer wants `import { Button } from "@interlace/primitives"` instead of shadcn-CLI vendoring, the next step is mechanical.

## License

[MIT](./LICENSE)
