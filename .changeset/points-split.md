---
'@interlace/ui': minor
---

Spend a budget of points across options. `PointsSplit` gives each option a minus and a plus (named per option), a bar for its share of the budget and a live count of points left; Send unlocks once the budget is spent, or earlier with `partial`. `PointsTotals` shows the room's points per option, most first, each row read as one line, gliding to its new rank. The rules are pure (`games/points-model`: `checkSplit`, `totalPoints`, `nudge`, `spentOf`); a split that breaks them is left out of the room's totals. Bars move by transform; under reduced motion they just change.

Components: points-split
