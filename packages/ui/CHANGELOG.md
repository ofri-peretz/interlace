# @interlace/ui

## 1.2.0

### Minor Changes

- b20d1c4: CodeBlock — Shiki notation contract: highlighted + diff lines

  Components: code-block

  Lines a highlighter marks `highlighted`, `diff add`, or `diff remove`
  (Shiki's `transformerNotationHighlight` / `transformerNotationDiff`, or
  anything emitting the same classes) are now styled by the block itself:
  token-backed washes that hold in both themes, edge-to-edge bleed through
  the pre's padding, and a `+` / `-` gutter marker so a diff is never
  color-alone. The copy button yields the post-diff code — `.diff.remove`
  lines are skipped — so nobody pastes the line they were told to delete;
  `select-none` nudges drag-selection the same way (a hint engines apply
  unevenly, not a clipboard barrier — the button is the guarantee).

- cfb2d96: CodeBlock — onCopied seam + honest copy affordance

  Components: code-block

  `onCopied?(text)` fires after a SUCCESSFUL clipboard write with the
  exact copied text — the measurement seam a receipts-honest consumer
  needs. Past-tense name is a documented R17 deviation: native `onCopy`
  already reaches the figure via `...props` and fires on selection-copy.
  Honesty fix riding along: with no clipboard API available the button
  used to flip "Copied!" without writing anything; it now stays quiet —
  no success is claimed that didn't happen.

- fe37d49: HeroStrand — the thread at page scale

  Components: none

  One strand-a ribbon drawn across a hero section, optionally crossed by
  the strand-b counter — the fourth and final scale of "One thread,
  every scale". A server component with zero client JS: the draw is the
  new `strand-draw` motion token (tokens.css, 600ms — the doctrine's
  ceiling), so the preflight reduced-motion clamp reaches it and
  reduced-motion users see the strand instantly drawn. Paths normalize
  with `pathLength=100`; `vector-effect` is deliberately absent (the
  Chromium screen-space-dash lesson from the first production weave).
  Ships under `effects/` (not a registry item yet, like the rest of the
  signature kit).

- 443ea96: CodeEditor + LintPlayground — paste code, watch analysis light it up

  Components: code-editor, lint-playground

  **CodeEditor** (primitive): an editable code surface whose visual layer is
  DIAGNOSTICS, not syntax colour — the other half of the CodeBlock pair. The
  zero-sync layout trick: the textarea auto-grows (`rows` = line count) with
  soft wrap off, so a highlight bar for line N sits at a fixed offset computed
  from the line-height — no scroll listeners, nothing to drift; the
  `leading-6`/`py-4` classes and the exported `LINE_HEIGHT_PX`/`PAD_Y_PX`
  constants are one test-pinned contract. Bars are `aria-hidden` position,
  never information, and severities differ by border, not hue alone.

  **LintPlayground** (pattern): editor + findings list + status around an
  INJECTED `lint: (code) => Promise<PlaygroundDiagnostic[]>` — the DS owns the
  surface and ships no linting dependency; the app brings a web worker
  bundling the real analyzer. Honesty rules, all test-locked: findings render
  as text first; stale results never paint (sequence-numbered, resolutions
  AND rejections); a failed analysis says "unknown, not clean" instead of an
  empty list; and the footer prints the privacy fact that makes pasting real
  code reasonable — analysis runs entirely in the reader's browser.

  Both join the coverage ledger at 100/100/100/100.

- b79603d: ReadingStrand — reading progress as the brand's draw verb

  Components: reading-strand

  A single strand-a line pinned to the viewport top that draws itself as
  the reader moves through the piece. Progress is state coupled to the
  reader's own scroll (nothing animates on its own — no reduced-motion
  variant to gate). Real `role="progressbar"` 0–100; measures at most
  once per frame via a passive listener; the fill moves with
  compositor-only `transform: scaleX`. `target` names the article element
  by id so server pages need no client seam; falls back to the whole
  document. SSR renders scaleX(0) — zero CLS.

- fc36ffa: SectionIndex — the numbered eyebrow

  Components: section-index

  A zero-padded mono numeral in the AAA brand orange (`text-primary`) beside an uppercase tracked
  label, making the page's sections a legible sequence ("01 THE AGENDA …
  04 THE PROOF"). The numeral counts the way a terminal counts (tabular
  figures, monospace) and is the view's meaning-point accent; screen
  readers hear "Section 2: The Agenda", never "zero two". No motion of
  its own — pass `<DecodeText>` as the label for the decode gesture.
  Drops straight into SectionHeader's `eyebrow` slot.

- 2218102: TimeSeries — mark two points, read the change between them

  Components: time-series

  Marking a point (click, or Enter from the keyboard) sets an anchor; marking a
  second turns the readout into a comparison — `2026-06-01 → 2026-08-01` with the
  absolute change, the percentage and the direction — and shades the span between
  them on the plot. A third mark starts a new range; Escape clears.

  The gesture most charts implement as a pointer drag, which no keyboard user can
  perform. Here both paths resolve through one `select()`, so they cannot disagree
  about what is selected.

  The delta is rendered by `Delta` rather than recomputed, so the sign, the
  percentage, the tone token and the WCAG 1.4.1 accessible name all come from one
  place. A point compared with itself clears the selection instead of reporting
  0%, and a range with a gap at either end shows nothing rather than bridging it.

- 12684a6: The Living Weave — motion, the radial poster form, and the strand field

  Components: time-series, radial-weave

  **TimeSeries draws itself.** The plotted series and their annotations are
  revealed by a clip rect that scales open left→right — the new
  `--animate-weave-reveal` token, the draw verb's second mechanism for a chart
  whose dash patterns ARE series identity (MOTION_PHILOSOPHY's draw-gesture
  exception gains the clip-reveal clause, and the motion lock verifies the
  utility only ever lands on a `clipPath` child). Pure CSS, SSR-drawn,
  from-only — with no animation at all, nothing is ever hidden. The reveal
  replays when the drawn geometry changes BY VALUE, never by array identity;
  the same change resets the crosshair during render. The crosshair now glides
  between slots on a transform transition (150ms, motion-reduce clamped) while
  the readout still snaps.

  **RadialWeave** — the same series wrapped around a dial: the POSTER form.
  300° sweep with the gap at the bottom (a closed circle claims the newest
  observation meets the oldest), the exact dash+hue identity table TimeSeries
  uses, nulls breaking the arc, an HTML centre value, and deliberately no
  crosshair — the aria-label sentence, the min/max readout and the lossless
  `SeriesTable` carry inspection. Server component; dial math lives in
  `scale.ts` (`dialAngle`/`dialRadius`/`dialPoint`/`dialPath`/`dialRing`).

  **StrandField** — real series lifted into depth: each thread on its own
  plane in a CSS-3D perspective stage (zero dependencies — `perspective` +
  `translateZ`, never WebGL), fanned apart or collapsed flat via `woven`,
  tilting inside its own bounds with the pointer (never under
  `prefers-reduced-motion`), strands entering by the strand-draw verb with a
  CSS-variable stagger the reduce clamp can zero. `aria-hidden` theatre with
  no focusable element; `onStrandSelect` is a pointer shortcut for a selection
  surface the consumer renders accessibly.

- 87bf160: TimelineMap: number-axis mode — the lanes × axis landscape over any continuous measure

  Components: timeline-map

  New `axis` prop (`{ kind: "number", format }`) positions dots by
  `item.value` instead of `item.date` — reading minutes, bundle KB, any
  quantity a corpus is actually navigated by. Nice-step ticks (1/2/5×10ⁿ)
  render through the consumer's `format`; aria-labels and the Detail
  strip speak the formatted value through one shared voice, so the two
  can never disagree. The date axis, the weave, and every interaction are
  unchanged; `date` is now optional at the type level (number-axis items
  don't need one).

- ecb89a5: TimelineMap: the reader's thread (`trace`)

  Components: timeline-map

  A new `trace` prop draws the reader's own path through the corpus —
  ordered visited ids threaded dot-to-dot in warm strand-a over the cool
  strand-b corpus web, with the draw verb (pathLength-normalized onto the
  shared `strand-draw` keyframe; instantly complete under reduced
  motion). The overlay is decorative and `trace.label` speaks the
  summary ("Your thread: 7 of 82 read"). Unknown and filtered-out ids
  skip, consecutive repeats collapse, and fewer than two visible points
  draws nothing — a single visited dot is a beginning, not yet a thread.
  SSR without the prop renders no trace: the honest crawler view, since
  reading history is client-only.

- 4239054: Toggle — `pill` variant + `xs` size; TimelineMap.Filter consumes it

  Components: toggle, timeline-map

  The filter pill (rounded-full chip, strand-a pressed tint, greyscale-safe
  border identity) is now a Toggle variant instead of classes open-coded
  inside TimelineMap.Filter — every "which categories/threads are active"
  surface styles from one home. `xs` is its native size: `min-h-6` sits
  exactly on the WCAG 2.2 SC 2.5.8 24×24 target floor (min-height, so a
  wrapped label grows the pill rather than clipping). TimelineMap.Filter
  now renders these Toggles — Base UI carries `aria-pressed` — with no
  visual change.

- 3fcd87e: The woven signature kit and the brand strand tokens.

  New: `TimelineMap` (patterns) — dated entities as dots on category lanes
  with fit-all width, a roving-tabindex keyboard composite, and the link
  weave (`item.links` draws the corpus's internal reference graph as
  strand-b threads with select-to-illuminate interaction); `InterlaceWeave`
  and `DecodeText` (effects/, new export subpath). New brand tokens
  `--interlace-strand-a` / `--interlace-strand-b` in both themes, with the
  WCAG 1.4.11 floor measured by the theme-contract lock.

  Fixed: the preflight applied `height: auto` to svg/canvas, defeating
  explicit sizing utilities on every viewBox'd svg — now photographic
  media only, matching Tailwind's own preflight.

  Components: timeline-map

### Patch Changes

- d8f1baa: CodeBlock — dead header conditional removed, docs match behavior

  Components: code-block

  `Boolean(title) || Boolean(language) || true` never evaluated its left
  side and the file docs still described a header that could be omitted.
  The header ALWAYS renders (the copy button needs a home); the code and
  both doc blocks now say exactly that. No runtime change.

- 0393578: TimelineMap — dot hit radius 12 → 13

  Components: timeline-map

  The nominal 24px hit union measured 23px in a real browser
  (sub-pixel rounding), one under the SC 2.5.8 floor. r=13 carries a
  2px margin; still paints nothing.

- fa421aa: HeroStrand: aria-hidden omitted from the props type

  Components: none

  The always-decorative contract gains its type layer: `aria-hidden` is
  Omit-ed from HeroStrandProps (strips autocomplete, rejects
  object-literal construction). Measured honestly: TS checks aria-\* JSX
  attributes leniently, so the runtime override guard remains the
  enforced layer — the source comment says exactly that.

- f0dcf94: The link weave budgets its rest ink by density: a sparse web keeps each
  thread readable (0.25), while a heavily cross-cited corpus (the blog's
  735 threads) recedes into texture (>48 edges → 0.10, >160 → 0.04) so the
  dots stay primary. The illuminated selection keeps full strength at any
  density.

  Components: timeline-map

- 45b8c48: TimelineMap: filtering out the focused dot's lane no longer traps the
  keyboard — a focus id outside the visible order falls back to the recent
  end, so the composite always keeps exactly one tab stop.

  Components: timeline-map

- cccd144: StrandField planes keep a vertical safe band

  Components: none

  Planes sit at `inset-x-0 top-6 bottom-6` instead of `inset-0`: the field
  clips in screen space, and a plane at `translateZ` under the stage's
  `rotateX` projects its top edge ~20px above its own box — a strand whose
  line or label ended high was losing its top half to `overflow-hidden`
  (found walking the blog's `/loom` at 375 and 320).

  The fan is now a bounded depth ENVELOPE (±46px) rather than a 46px
  per-plane step: more strands pack denser, never deeper, so the band's
  guarantee holds at every strand count — a per-plane step put the
  7-strand front plane at z=138px and ~60px of projection, more than
  double the band.

- 101553c: TimeSeries — the first mark stays visible, and Space is documented

  Components: time-series

  Two review findings from the consumer side.

  Tapping once left no visible trace: the pointer leaves, `cursor` goes null, and
  the whole marker disappeared with it. For touch that is the normal state
  between the first tap and the second, so a touch user had no sign their mark
  had registered. The selection was always kept in state; only the evidence was
  missing. The anchor edge is now drawn whether or not a second edge exists.

  The accessible name promised Enter but Space has always worked too, so the key
  existed for anyone who guessed it and nobody else.

- cf93e42: TimelineMap — dot links get a 24px hit area

  Components: timeline-map

  The visible dots can be as small as 10px — under the 24px target
  floor of WCAG 2.2 SC 2.5.8, and genuinely hard to tap. Each dot link
  now carries a transparent r=12 hit circle behind the painted dot:
  pointer geometry grows to 24px, the visual stays the map's scale.
  Caught by the blog's layout audit at every viewport.

- c2a198d: TimelineMap — filter pills clear the SC 2.5.8 and AA floors

  Components: timeline-map

  The category filter pills rendered 22px tall (under the 24px target
  floor of WCAG 2.2 SC 2.5.8) and hardcoded the count span to
  muted-foreground, which measured 4.37:1 on the active pill's
  strand-a/10 tint — under the 4.5 AA floor. Pills are now inline-flex
  min-h-6; the count inherits the pill's state colour. Caught by the
  blog's real-layout audit across every viewport.

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
