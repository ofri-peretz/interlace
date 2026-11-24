---
'@interlace/ui': minor
---

`Distribution` and `NetworkGraph` can be shown in any language. `Distribution` takes `labels` (the unnamed value and reference words, the empty note, the readout's "not measured", the keyboard instructions, the table caption and empty cell, and the spoken summary) and a `locale`. `NetworkGraph` takes `labels` (the error and empty notes, the header counts, the cap buttons, the keyboard instructions, the selection hint, the table caption and headers, the "None" group, the below-cap note and the spoken summary) and a `locale`. `describeDistribution` and `describeGraph` build their sentences from new `DistributionSummary` and `GraphSummary` types, with `distributionSentence` and `graphSentence` as the English defaults. English output is unchanged, except that the graph's counts now use thousands separators. `compact` documents why its suffixes stay k, M and B in every locale.

Fixed: `Distribution` no longer crashes when new, shorter data arrives while the keyboard cursor is past its end.

Components: distribution, network-graph
