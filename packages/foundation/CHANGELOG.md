# @interlace/foundation

## 0.2.0

### Minor Changes

- edee2e9: Initial public release. CSS-only npm proof of the Interlace design-system contract — five stylesheets distributed as plain CSS for any framework:
  - `tokens.css` — motion + animation keyframes (marquee, shimmer, accordion-height, border-beam, fade/slide/scale-in), all gated under `prefers-reduced-motion: reduce`.
  - `foundation.css` — type scale (`--text-h1`..`--text-caption` + `--text-long`), six-step spacing scale (`xs`..`2xl`), three-step radius scale, container widths (prose / content / wide / full), font tokens (Inter + JetBrains Mono).
  - `preflight.css` — token-aware baseline beyond Tailwind preflight: WCAG 2.2 SC 2.4.13 focus ring (2px solid, 2px offset, ≥3:1 contrast), `::selection`, scrollbar tint, smooth-scroll respecting reduced-motion, `::placeholder` AA contrast, tabular-nums, `[data-min-viewport]` container contract, `forced-colors` Highlight.
  - `theme.css` — shadcn↔fumadocs token bridge, Shiki AAA contrast boosts (github-light + github-dark themes), TOC visual fix, remote-content classes.
  - `interlace-theme.css` — violet brand palette (light + dark, AAA-cleared), five chart-series hues, three-step radius binding.

  Install:

  ```bash
  npm i @interlace/foundation
  ```

  Then import:

  ```css
  @import "@interlace/foundation"; /* full DS baseline */
  /* or just the focus + min-viewport contract */
  @import "@interlace/foundation/preflight.css";
  ```
