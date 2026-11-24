---
'@interlace/ui': minor
---

New `DotPlot`: one dot per value on a shared axis, one row per thing compared. With two or more series a line joins each row's dots, so the line's length is the gap and its direction is the change. The axis need not start at zero, ticks are round numbers that stay text-sized at any width, and the first series is a hollow ring so series differ in shape as well as colour. Each row reads as a sentence, a legend entry picks out a series, and a table carries the same numbers.

Components: dot-plot
