---
'@interlace/ui': minor
---

New `ShareChart`: how a whole splits into parts, one bar per row on one shared scale. `layout="stacked"` runs every bar from the same edge to 100%; `layout="diverging"` puts an ordered scale around a zero line shared by every row, with a `neutral` category across it and each side's total printed at its end. Values become shares of the row's total (the sum, or `total`), so counts and percentages both work. Stacked categories take the five chart hues in order; diverging ones take two `poles`, strongest at the ends. Hovering a segment or a legend entry, or focusing one, dims the other categories and prints that share on every row; a click pins it. Every row carries a sentence with every share, and a table of values sits behind the picture (`showTable` shows it). On first view each bar grows out of its zero line once; nothing moves under reduced motion. Labels sit beside the bars when the chart's own box is wide enough and above them when it is not, and the bars mirror in right-to-left pages. `shareOf`, `shareLayout`, `shareFills` and `describeShareRow` are exported and pure.

Components: share-chart
