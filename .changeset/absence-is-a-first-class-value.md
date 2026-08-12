---
'@interlace/ui': minor
---

Absence becomes a first-class value. `DataState` grows from four states to
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
