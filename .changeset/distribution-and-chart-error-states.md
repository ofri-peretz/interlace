---
'@interlace/ui': minor
---

New `Distribution` chart — a quantity spread over a fixed set of named bins,
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
