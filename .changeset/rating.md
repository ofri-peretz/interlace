---
'@interlace/ui': minor
---

A scale question for a room. `Rating` lets each person pick one step (a radio group: arrow keys move, each step has a name) and send it, then shows the room's answers on the same scale with their own step in the accent, the room's average in one focused sentence, a dashed outline for an earlier round (`before`), and for a 0 to 10 scale the recommend score. `faces` swaps the numbers for icons with names, for a mood check. `minResponses` keeps the room hidden until enough have answered. The rules are pure (`games/rating-model`: `summarizeRatings`, `ratingShift`, `ratingSteps`, `cleanRatings`) and drop answers off the scale. The bars grow from the baseline in 250ms; under reduced motion the chart is simply there.

Components: rating
