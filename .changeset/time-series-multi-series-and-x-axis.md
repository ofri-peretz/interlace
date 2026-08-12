---
'@interlace/ui': minor
---

`TimeSeries` can plot more than one metric, and it finally draws an x axis.

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
