# @interlace/ui

<!--
  Changesets prepends each new `## x.y.z` section directly under this title, so
  the paragraphs below get pushed under the newest release on every version
  bump. Move them back when you notice; it is cosmetic. It used to be fatal:
  `Components:` is the last field of an entry and the parser let fields wrap,
  so it swallowed this prose and reported it as an unknown registry item.
  `parseEntryBody` now ends every field except `Migration:` at a blank line.
-->

Release notes for the Interlace design system. Rendered publicly at
<https://ds.interlace.tools/changelog> — that page is generated from this file
plus the pending `.changeset/*.md` entries, so this is the single source.

`@interlace/ui` is **not published to npm**. It is distributed as copied
source through the shadcn registry at ds.interlace.tools, which means there is
no `npm update` and no version range: the changelog _is_ the upgrade path. See
`docs/philosophies/VERSIONING_PHILOSOPHY.md`.

## 1.1.0

### Minor Changes

- eb6b23b: Absence becomes a first-class value. `DataState` grows from four states to
  nine, and two new primitives consume the union as a contract rather than each
  re-deriving it from a boolean ladder.

  The states are `loading · error · not-applicable · not-counted · empty ·
partial · truncated · first-measurement · idle`, and that list is also the
  precedence order — lowest wins. Error beats empty, because a failed fetch is
  not "no results". Truncated is not empty at all: it qualifies a body that
  still renders. States co-occur, so `resolveDataState` returns the winner AND
  every loser as `qualifiers`, the wrapper publishes them as `data-qualifiers`,
  and the announcement says all of them — a list that is both partially covered
  and truncated is wrong twice and now says so twice.

  Each state is drawn distinctly and, more importantly, **announced**. A diagonal
  hatch means no run happened; a dashed outline means not yet real; the accent
  is spent on `first-measurement` alone, because it is the only absence a reader
  can act on. Every one of those carries a sentence via `announceDataState` —
  "Not counted. No measurement was taken; this is not a zero." A hatch that
  exists only in pixels keeps the distinction for sighted readers and destroys
  it for everyone else, and axe scores that green.

  `StatStrip` is the dense measurement grid that appeared in all six of the
  audited artifacts, hand-rolled four times: mono micro-label, `tabular-nums`
  value, optional note, optional delta, on a `<dl>` so every number keeps its
  label. It renders the three-state null honestly — a metric with `prior: null`
  shows "first measurement" and the caller's delta node is **not rendered at
  all**, so there is no path by which a missing prior reaches the DOM as `+0%`.

  `Meter` absorbs three hand-rolled bars (an odds bar, a score meter, a reviewer
  bar). Magnitude is carried by length AND by the printed number, never by hue,
  and the number is not optional. `value: null` hatches by default rather than
  drawing an empty bar, because an empty bar and a measured zero are the same
  picture. `variant="dead"` recedes without vanishing, for a dormant row that
  still holds its rank. `RankedBarList` is the repeated-row composition and
  supports a labelled log scale, so a 10k row and a 10M row can share an axis.

  Pure logic ships alongside as `data-state-model` and `meter-scale` — the
  union, the precedence, the announcements, the scale maths — with no React
  import, exported for callers wiring their own state.

  `Skeleton` gains `meter` and `stat-strip` variants, both composites, so the
  loading state reserves the real silhouette on the real breakpoints.

  Not included, deliberately: the domain vocabularies these were extracted from
  (`authority`, `visibility`, `dormant`, `unwritten`, `ungated`) stay in their
  artifacts as labels a caller passes in. They are subject-matter, not design
  system — the DS ships the two axes underneath them (does it recede or does it
  act, and did a run happen) rather than nine nouns it cannot define.

  Components: data-state, data-state-model, stat-strip, meter, meter-scale, skeleton

- eb6b23b: New `Combobox` and `CommandPalette`.

  `Combobox` mirrors `Select` part-for-part, plus one part that is ours rather
  than Base UI's: `ComboboxControl`, a `relative` row. Base UI has no concept of
  "the input plus the affordances docked inside its border", and without it
  `ComboboxClear` and `ComboboxTrigger` sit beside the field instead of in it.
  The root is aliased rather than wrapped so the `<Value, Multiple>` generics
  survive at the call site.

  `CommandPalette` is a composition, not a new primitive: `DialogContent`
  supplies the portal, backdrop, focus trap, Escape and focus restore, wrapped
  around `Combobox.Root` in **`inline`** mode. That flag is load-bearing —
  without it the combobox handles Escape for a popup that is not open and the
  dialog never closes, a WCAG 2.1.2 keyboard trap. `closeOnSelect` closes by
  clicking a hidden `DialogClose` rather than calling `setOpen`, so it routes
  through Base UI's own close path: `onOpenChange` fires with a real reason,
  focus restores exactly as for Escape, and the uncontrolled case works.

  The ⌘K binding is a separate opt-in hook. A design system should not seize a
  global chord on mount from every app that installs it.

  Three rows of the keyboard contract differ from `Select` and are the ones
  callers get wrong: Home/End move the text caret rather than the highlight;
  Escape on a _closed_ popup clears the input and the selection; focus never
  enters the list — it is virtual focus via `aria-activedescendant`.

  Components: combobox, command-palette

- eb6b23b: New `DataTable` pattern — a real `<table>` with column definitions, sorting,
  row selection, pagination, and designed loading / empty / error states.

  Sort and selection are the caller's state (`sort` / `onSortChange`,
  `selected` / `onSelectionChange`), so the whole view can live in the query
  string and a sorted, paged, partly-selected table can be linked to a
  colleague. Selection is keyed by row id, so it survives sorting and paging.
  Semantics are the point: `<caption>`, `<th scope="col">`, one
  `<th scope="row">` per row, `aria-sort` on sortable headers, and a selection
  checkbox whose accessible name identifies the row. Pure logic (sort cycle,
  comparators, page-window, selection maths) ships alongside as
  `data-table-model` and is exported for callers wiring their own URL state.

  Skeleton gains a `data-table` variant — a header row plus body rows, so the
  loading state reserves the real silhouette instead of collapsing to a spinner.

  Not included, deliberately: filtering UI, column resize/reorder,
  virtualization, grouping.

  Components: data-table, skeleton

- eb6b23b: New `Distribution` chart — a quantity spread over a fixed set of named bins,
  read against a reference distribution.

  It is a new component rather than an extension of `TimeSeries` because three of
  that component's properties are chronological and cannot be parameterised out:
  its axis keys are sorted (`['Thu','Fri','Sat']` sorts into a week that does not
  exist), a line asserts the metric passed through every value between two
  samples when between two hourly aggregates there is nothing to pass through,
  and `delta()` first-to-last is arithmetic performed on a circle.

  An unmeasured bin **hatches**. Everywhere else a `null` can simply be dropped,
  but for bars a height of zero and a bar never drawn are the same picture — this
  is `null ≠ zero` at its hardest case. `bin.note` prints a second axis reading
  under the first, replacing the timezone toggle a caller would otherwise build;
  a toggle hides half the truth and is missing from every screenshot.

  Also: `error` states on every chart that fetches — `TimeSeries`, `Sparkline`,
  `MetricTable`, `NetworkGraph`, `Distribution` — resolved through
  `resolveDataState` so the precedence is the array in `data-state-model` rather
  than five hand-rolled ladders. In a dashboard "the fetch failed" and "there is
  no data" are different statements. `Delta` and `SeriesTable` get none: neither
  has a fetch lifecycle.

  `StatItem` gains `tone`, carried by three signals rather than a hue alone — the
  rail, the value colour, and an `sr-only` judgement.

  Components: distribution, time-series, sparkline, metric-table, network-graph,
  stat-strip, series-table

- eb6b23b: `TimeSeries` can plot more than one metric, and it finally draws an x axis.

  `compare` takes further series — `{ points, label, unit }` — drawn against the
  same axes. It is purely additive: `points` is still the required single-series
  prop it always was, so nothing that already calls this component changes. Each
  line gets a `--chart-N` hue **and** a distinct dash pattern, and the new legend
  swatch repeats the dash, so two lines stay two lines in a greyscale print and
  to a red-green colour-blind reader. Five series are drawn (the size of the
  palette); any beyond that stay in the data table and the legend says how many.

  All series share one y domain, and that is not configurable. A second y axis
  lets an author slide two unrelated metrics until they appear to cross wherever
  the argument needs them to; a series two orders of magnitude smaller will render
  as flat here, which is the true statement about it.

  The x axis is a baseline, a tick per labelled slot, and up to five HTML labels
  below the plot — HTML because SVG text scales with the `viewBox`, and at a 320
  viewport this plot is 288px wide against a 900-unit box, so `text-xs` inside it
  paints at 4px. Below `sm` the middle labels drop and the two ends stay.

  The crosshair readout now names and values every series at the cursor, from the
  one `aria-live` `<output>` that the arrow keys already fed. There is deliberately
  no second, hover-only tooltip to fall out of step with it.

  Components: time-series
  Kind: Added

### Patch Changes

- eb6b23b: Six defects found by upgrading a real consumer, plus five found by reading the
  components closely enough to document them.

  **`Meteors`' glow never painted.** It read `var(--color-meteor-glow)` while its
  `cssVars` declare `--meteor-glow`; `--color-*` is the Tailwind `@theme`
  namespace and only `cssVars.theme` populates it, so the whole `box-shadow` was
  invalid at computed-value time. **This was broken only for registry consumers**
  — our own docs site hand-declares the `--color-` form.

  **`ArticleCard` cropped 28% off every cover.** `h-44` is 176px; at a ~302px
  tile that is a 1.72:1 box against a 2.381:1 image. Now `aspect-[1000/420]` —
  the ratio the card already declared on its `<img>`. It also gains a
  `renderImage` slot, because every Next.js consumer was re-patching the same
  line to use `next/image` and the design system cannot depend on it.

  **`BorderBeam` and `StarsBackground` had no `aria-hidden` at all** — six purely
  decorative nodes a screen reader walked. **`CloudParticles` defaulted
  `bodyColor` to `currentColor`**, painting volumetric clouds in the inherited
  text colour. **`NumberTicker` gains `notation`**, because six-figure metrics
  overflow a tile at 320px.

  Also: `SheetCompose` and `DialogCompose` each mounted a second backdrop, so a
  composed dialog dimmed the page twice as much as the hand-composed tree the
  docs show; `Accordion` dropped `className` on the animated Panel; `Tooltip`
  accepted `delay` and discarded it; `PopoverAnchor` was a second trigger.

  **`useReducedMotion` was one frame late.** The canonical `useState(false)` plus
  effect returns `false` on the first render, so every gated component painted
  one frame of exactly the motion the user turned off. `useSyncExternalStore`
  reads during render and closes that on client renders; on hydration the server
  cannot know the preference, which is what the stylesheet reset is for.

  `Badge` drops `'use client'` — verified with a real server-component build.

  Components: meteors, article-card, border-beam, stars-background, cloud-particles, number-ticker, sheet, dialog, accordion, tooltip, popover, badge, use-reduced-motion

- 2e3facd: The fourteen `blocks/*` re-export aliases now name the release they disappear
  in. They previously said "removal scheduled for one release cycle after the
  architecture PR lands", which is not a date anyone can plan around — so the
  aliases were, in practice, permanent. They are now `@deprecated since 1.0.0 —
removed in 2.0.0`, and removal will land as a breaking change with a migration
  note.

  Kind: Changed
  Components: article-card, author-byline, code-window, empty-state, figure,
  hero, newsletter-form, page-header, prev-next-post, related-posts,
  section-header, share-buttons, sign-in-form, stat-card
  Migration: Nothing changes today — `@interlace/ui/blocks/<name>` still
  resolves. Before 2.0.0, change those imports to
  `@interlace/ui/patterns/<name>`; the exported names are identical.

- eb6b23b: Every component now describes itself, and 59 gained a file header.

  `description` said `"@interlace/ui — accordion (shadcn-compatible)."` for 128
  of 137 items — the item's own name, restated. That field is what `shadcn add`
  prints in your terminal, what the shadcn directory lists us under, what every
  card on the storefront shows, what `<meta name="description">` and OG carry,
  and what an agent reads to choose between two components. All of it said
  nothing.

  The sentence already existed in each component's header and was already being
  extracted — into `agent-index.json`, the one surface an adopter never looks at.
  It is now derived once and published everywhere. Boilerplate descriptions went
  128 → 0 and empty `topics` 72 → 19.

  What reaches your tree: the 59 components that gained a file header now carry
  that header in the installed copy. It is a comment block — no behaviour, no
  class names and no exports change. Everything else here is registry metadata
  that never leaves our side.

  Components: none

- 2e3facd: The three entry animations in `styles/theme.css` now run at 200ms with no
  delay, and the reduced-motion class list in `styles/tokens.css` covers
  `.animate-pulse`.

  `.animate-fade-in-up` was 0.5s, `.animate-slide-in-left` 0.5s behind a 0.3s
  delay, and `.animate-scale-in` 0.4s behind a 0.2s delay — up to 800ms before
  the reader saw anything, against the 200ms entry ceiling
  `MOTION_PHILOSOPHY.md` has always set. All three are now
  `0.2s ease-out both`. The delays were the worse half: an entry animation is
  already laid out at `opacity: 0`, so a delay is time spent looking at nothing.

  Separately, `.animate-pulse` — the animation `Skeleton` renders on every
  loading state — was missing from the `tokens.css` reduced-motion list, along
  with `.animate-meteor` and `.animate-meteor-effect`. The universal clamp in
  `styles/preflight.css` was already covering all three, so apps importing
  `styles/index.css` were never affected; apps that import `tokens.css` and
  `theme.css` à la carte and skip `preflight.css` were. All three are now
  listed.

  Both are held by `packages/ui/__tests__/motion-contract-lock.test.ts`, which
  reads the ceiling out of `MOTION_PHILOSOPHY.md` rather than repeating it, and
  fails if any bare `animate-*` utility in `packages/ui/src` is missing from the
  list.

  Kind: Changed
  Components: theme, skeleton, meteors, stars-background

- 2e3facd: Two theme defects that only a browser could find, both of which read as "the theme system does not work".

  `useTheme()` now keeps every instance in the SAME document in sync. Each instance owned private React state and only listened for `storage` events — which fire in OTHER documents — so a switcher in the nav updated itself and nothing else. A page with a switcher plus any second theme-aware component repainted the switcher and left the component on the previous theme, permanently.

  Harbor now declares its dark palette for `[data-theme='harbor'] .dark` and `[data-theme='harbor'] [data-scheme='dark']` as well as the same-element forms. The bare `.dark` block is unscoped, so it means "Interlace dark": it re-declares every `--interlace-*` literal on whatever element carries it, and `[data-theme='harbor'].dark` needs both on the same element. A `<div class="dark">` anywhere inside a Harbor page therefore repainted that subtree in the default brand. `theme-contract-lock` now requires the descendant forms from every registered theme.

  Components: theme-switcher

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
