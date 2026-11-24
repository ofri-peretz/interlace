---
'@interlace/ui': minor
---

New `SeatChart`: how an assembly divides its seats, as a half-circle of dots filled group by group from left to right, with the majority marked at the top and a caption under the arc ("61 needed for a majority", or `majorityLabel`). By default every group gets its own colour: the five chart hues, then the same hues deepened, then neutral, so eleven lists stay apart in light and dark. Groups can also sit on `sides` (government and opposition, say): each side has one tone, its groups take shades of it, the first side fills from the left and the last from the right, and `tally` puts big side or leader totals above the arc. Hovering or focusing a group dims the rest and shows its count; a click pins it. The legend prints every count, the picture carries a sentence naming the total, each group and the distance to a majority, and a table sits behind it (`showTable` shows it). Seats no group holds are outlines counted as vacant. On first view the seats fill in once, under a second; nothing moves under reduced motion. `SeatChartCompare` sets two or three charts side by side by its own width. `seatLayout`, `placeGroups` and `describeSeats` are exported and pure.

Components: seat-chart
