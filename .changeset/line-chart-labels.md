---
'@interlace/ui': minor
---

The line charts can be shown in any language. `TimeSeries` and `RadialWeave` take `labels` (a shared `TimeSeriesLabels` set: the unnamed-series word, the empty note, the readout's missing word, the "more not plotted" note, the keyboard instructions, the table caption, date header and empty cell, the spoken summary and the comparison's words) and a `locale` for their numbers. `Delta` takes `labels` for its empty note and spoken sentence, and a `locale`. `Sparkline` takes `summary` and `locale`. `SeriesTable` takes `noDataLabel` and `locale`. `describeSeries` builds its sentence from a new `SeriesSummary`, with `seriesSentence` as the English default, and `compact` takes a locale. English output is unchanged. `SeatChart`'s `seatsLabel` doc now says the spoken sentence has its own words.

Components: time-series, radial-weave, delta, sparkline, series-table, seat-chart
