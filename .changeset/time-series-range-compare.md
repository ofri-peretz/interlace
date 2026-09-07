---
"@interlace/ui": minor
---

TimeSeries — mark two points, read the change between them

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
