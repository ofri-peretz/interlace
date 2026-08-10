# Visualization philosophy

How Interlace draws data. Sibling to `DATA_TABLE_PHILOSOPHY.md` (which governs
tabular data at rest) and `COLOR_PHILOSOPHY.md` (which owns the token graph this
document consumes).

The reference points are finance UIs — TradingView and roic.ai — because
finance is the domain where people actually *investigate* data rather than
glance at it, and it has had thirty years to find out what works.

---

## 1. The row beats the chart

roic.ai did not build 186 visualisations. They built **one row** — metric name,
values across time, a sparkline, a delta — and repeated it, then let a click
promote any row into the chart above.

Density is the product. A column of rows lets the eye scan a decade; a grid of
chart cards lets it scan a quarter and then scroll. **Anything that looks like
it needs a new chart type should first be attempted as a new ROW.**

Practically: `MetricTable` is the centrepiece of this package, and `TimeSeries`
is the thing a row gets promoted into. If a new surface wants a bespoke chart,
the first question is what row it would have been.

## 2. The annotation is the argument

A line going up is a fact. A line going up **with a publish marker at the
inflection** is an argument. Chrome — grid, axis, crosshair — exists so the
annotation can be read against a scale.

Three annotation kinds, and they are distinguished by **shape first, hue
second**: `publish` (circle), `release` (diamond), `action` (triangle). Shape is
what survives a greyscale print, a colour-blind reader, and a screenshot pasted
into Slack at 40% width.

If a feature does not help someone connect a thing they did to a number that
moved, it probably belongs in a different component.

## 3. The a11y bar for a chart is a table

Not a caption. Not an `aria-label`. A real `<table>`.

`role="img"` plus a computed `aria-label` (see `describeSeries`) gets a screen
reader a one-sentence summary — enough to know *what happened*, never enough to
know *what the value was on the 14th*. Every chart in this package therefore
ships a `<SeriesTable>`, `sr-only` by default.

Three things fall out, in descending order of how often they are remembered:

1. **A11y** — WCAG 1.1.1 wants a text equivalent, and for data the equivalent is
   the data.
2. **SEO** — a crawler indexes the table, not the path geometry. Our charts
   become the answer to a query instead of an image near one.
3. **Verifiability** — Ctrl+A over a chart yields nothing; over the table it
   yields a pasteable TSV. For a project whose pitch is measured claims, letting
   a reader check our arithmetic is not a nicety.

**Axe cannot verify any of this.** It reads an SVG as one opaque node and scores
a labelled chart green whether or not the values are reachable. Same lesson the
1.1 and 1.2 component waves learned from the other direction: a green axe run is
necessary and never sufficient.

## 4. Every value is reachable from the keyboard

The near-universal failure of charting libraries: hover-only inspection means
the values exist for mouse users and for nobody else.

Contract: the plot is focusable, ←/→ step the crosshair, Home/End jump to the
ends, Escape clears it, and the readout is `aria-live="polite"`. The pointer path
and the keyboard path resolve through **the same** `nearestIndex` call, so a
keyboard user and a mouse user can never be told different things.

Axe cannot press a key. Every interactive chart owes a Storybook `play` function
and a real key-driven test.

## 5. Direction is never carried by colour alone

Rising draws `--viz-positive`, falling `--viz-negative`. Roughly 8% of men
cannot tell those apart, so direction is **also** a glyph (▲ ▼ –), **also** a
sign (+ / −), and **also** a sentence in the accessible name. Any one of the
four is sufficient on its own.

If you find yourself deleting the glyph because "the colour already says it", it
does not.

### And "good" is not a property of a number

A rising error rate is bad; a rising follower count is good. `Delta` takes a
`polarity` prop and metrics like latency, cost and bounce rate must pass
`inverse`. The default (`up = good`) is the common case, not a universal truth —
a dashboard that paints a regression green is worse than one with no colour.

## 6. No charting dependency — and the named exit

SVG plus a scale function is the entire engine. Reasons, in order:

1. **Registry installability.** A shadcn registry item must install from a bare
   `npx shadcn add` with every import resolvable. A charting library is a
   dependency the consumer's project has to already have, or acquire.
2. **Layout ownership.** d3, recharts and visx each want to own layout, which
   means our token layer stops being the thing that decides what a chart looks
   like.
3. **Bundle.** These components are small enough to read in one sitting.

**The exit is named, not pre-built.** If one surface ever needs >5k points with a
live crosshair, *that component* goes to canvas. It does not drag a library into
the other twenty. Do not pre-emptively adopt a charting library "for when we need
it" — that is the decision this section exists to prevent.

Where a chart needs real interactive **chrome** — a rich tooltip, a range
switcher, a scrollable legend — use the Base UI primitives we already ship
(Popover, Toggle, Tabs, ScrollArea). Base UI owns the a11y; we own the pixels.

## 7. Scales tell the truth

- **A gap is not a zero.** `null` means unmeasured. `numeric()` drops it rather
  than coercing it, because averaging over an invented zero silently
  manufactures data. Interpolation must be asked for explicitly.
- **Axis ticks label the observed domain, not a textbook scale.** A metric that
  ran 3,412 → 3,588 gets ticks inside that band. Rounding out to 0–4,000
  flattens the only thing the reader came for. (The inverse abuse — a truncated
  axis that turns 2% into a cliff — is prevented by the axis labels always being
  present and legible, never by hiding the scale.)
- **A flat series is centred, not pinned to the top.** Zero span must not render
  as a metric at its ceiling.
- **A percentage change from a zero baseline is `null`, not Infinity.**
  "+Infinity%" on a dashboard is how a metric that started at nothing gets
  reported as an achievement.

## 8. The token layer owns the palette

Charts never reach outside the token graph. `--chart-1..5` answer "which line is
which"; the `--viz-*` family answers "what is the line drawn on" — grid, axis,
crosshair, edges, nodes, bands, annotation kinds, direction.

Three of those resolve to brand hex (`grid`, `axis`, `edge`); **every other
`--viz-*` token is a `var()` alias of an already-AA-verified token.** A diverging
red/green scale that drifts away from `--success` / `--destructive` is how a
product ends up with two greens that mean "good". One fork surface, one green.

Contrast contract, measured (never eyeballed — see `COLOR_PHILOSOPHY.md`):

| Token | Light | Dark (bg / card) | Status |
|---|---|---|---|
| `--viz-grid` | 1.37:1 | 1.36 / 1.27:1 | **decorative** — never the sole carrier of a value |
| `--viz-axis` | 3.49:1 | 3.83 / 3.58:1 | clears WCAG 2.2 SC 1.4.11 |
| `--viz-edge` | 1.37:1 | 1.36 / 1.27:1 | ambient graph texture |
| `--viz-edge-active` | 9.4:1 | 11:1 | the edge that *means* something |

The grid/axis split is the same pattern as the slider rail vs knob: the
low-contrast element is supplementary, the high-contrast one carries the success
criterion. A dense grid at 3:1 fights the series it exists to support.

## 9. A chart is a component with a contract, not a picture

Same floor as every primitive: R1–R26, a skeleton variant, `MIN_VIEWPORT`, a
forwarded ref, a JSDoc contract table, reduced-motion gating, a story, a registry
item, and a per-file contrast table.

Coverage: `src/charts/**` holds **100/100/100/100** on v8. The pure module
(`scale.ts`) is where that has teeth — a chart that draws a beautiful wrong line
is worse than one that fails to render, and arithmetic is the part that can be
proved rather than reviewed.
