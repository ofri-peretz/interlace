# @interlace/ui

Release notes for the Interlace design system. Rendered publicly at
<https://ds.interlace.tools/changelog> — that page is generated from this file
plus the pending `.changeset/*.md` entries, so this is the single source.

`@interlace/ui` is **not published to npm**. It is distributed as copied
source through the shadcn registry at ds.interlace.tools, which means there is
no `npm update` and no version range: the changelog *is* the upgrade path. See
`docs/philosophies/VERSIONING_PHILOSOPHY.md`.

## 1.0.0

### Major Changes

- The design system takes a version. `@interlace/ui` was `0.0.0` with no
  changelog, no release tag and no per-component version, while
  ds.interlace.tools had already been serving installable copies of every
  component. 1.0.0 is the first release with a written contract behind it:
  semver, per-component versions derived from git, a public changelog, and a
  documented definition of what "breaking" means for source you copied.

  Components: none
  Migration: Nothing to do. Components installed before 1.0.0 carry no version
  banner in your tree; anything installed from 1.0.0 onward does. To adopt the
  banner on an already-installed component, re-run
  `npx shadcn@latest add @interlace/<name>` and keep your local edits.

### Minor Changes

- The visualization layer ships: a token-driven chart set built on the
  `VISUALIZATION_PHILOSOPHY` row-first doctrine — `MetricTable` as the
  centrepiece, `TimeSeries` as the thing a row is promoted into, plus a
  network graph, sparklines and deltas. Every chart carries the DS-wide
  `loading` skeleton opt-in.

  Components: metric-table, time-series, series-table, network-graph,
  sparkline, delta

- The component floor reaches every tier: form, overlay, navigation and
  display primitives were modelled to the portable 26-rule floor with
  skeletons, locked breakpoints, and AA contrast measured per composite
  rather than eyeballed.

  Components: input, textarea, select, checkbox, radio-group, switch, slider,
  number-field, form, label, dialog, alert-dialog, sheet, popover, tooltip,
  hover-card, dropdown-menu, context-menu, tabs, accordion, collapsible,
  breadcrumb, pagination, toast, card, badge, avatar, alert, separator,
  progress, skeleton

- The five-layer architecture lands: primitives → patterns → charts →
  templates, with `SectionBoundary` as the composition seam and thirteen
  full-page templates installable as registry blocks.

  Components: section-boundary, article-template, auth-template,
  author-template, blog-home-template, dashboard-template, docs-page-template,
  error-template, landing-template, registry-item-template, scorecard-template,
  settings-template, stats-template, tag-template

- The brand layer is forkable: the whole palette moved from Tailwind violet to
  the burnt-orange/green Interlace palette inside `@layer interlace.brand`
  with zero component edits, and the CSS baseline ships as one installable
  `theme` item — tokens, foundation, preflight (WCAG 2.2 SC 2.4.13 focus ring
  and the `[data-min-viewport]` contract), the shadcn↔fumadocs bridge, and the
  brand palette.

  Components: theme

- Day-one install surfaces: three starter bundles that pull a curated set of
  items in one command, and the two library utilities every primitive needs.

  Components: a11y-starter, layout-starter, mdx-starter, cn,
  use-reduced-motion
