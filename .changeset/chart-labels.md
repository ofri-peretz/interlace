---
'@interlace/ui': minor
---

`ChoroplethMap` and `DotPlot` take a `labels` prop for every fixed word a reader meets: "No data", the legend and table names, the empty and hint lines, and the sentences read to screen readers. Sentences are functions, so a language can order and inflect them its own way. `describeMap` and `describeDotRow` take the same sentence function. English stays the default. In `DotPlot`'s table, a missing value now reads "No data" instead of a dash.

Components: choropleth-map, dot-plot
