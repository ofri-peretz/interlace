---
'@interlace/ui': minor
---

`SeatChart` takes `labels` and `locale`. Every fixed word (the empty note, Vacant, No side, the table headers and caption, the majority caption and cell) can be replaced, and the screen-reader sentence is built by `labels.summary` from a `SeatSummary`, so it can be written in any language. Counts and shares are formatted with `Intl.NumberFormat` in the given locale. English stays the default.

`ShareChart` takes `labels` too: the empty note, the legend's name, the table caption and row header, and the sentence read for each row. `describeShareRow` takes the same sentence function. `DotPlot`'s `rowSentence` now says that it words a missing value itself.

Components: seat-chart, share-chart, dot-plot
