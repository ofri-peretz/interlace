---
'@interlace/ui': minor
---

New `SeatChart`: how an assembly divides its seats, as a half-circle of dots filled group by group from left to right. Groups take a chart palette tone (1–5) or `neutral`; seats no group holds are drawn as outlines and counted as vacant; `majority` marks the top of the arc. The legend prints every count beside its name, the picture carries a sentence naming the total, each group and the distance to a majority, and a table of seats and shares sits behind it (`showTable` shows it). On first view the seats fill in once, left to right, under a second; nothing moves under reduced motion. `SeatChartCompare` sets two or three charts side by side by its own width and stacks them when narrow. The geometry (`seatLayout`) is exported and pure.

Components: seat-chart
