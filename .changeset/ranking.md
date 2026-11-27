---
'@interlace/ui': minor
---

Rank by preference, as a room. `RankChoices` starts every phone from the same seeded order (so no item is favoured by where it was printed) and moves rows with named up and down buttons or the arrow keys, Home and End on each row's handle, announcing each move and keeping focus on the moved row; rows glide with FlipGroup. `RankResults` shows the room's order with each item's average place, read as one line per row, gliding as answers arrive. `games/ranking-model` tallies places into the room's order (`tallyRankings`, a Borda count with ties broken by first places) and says how much the room agrees with it (`roomAgreement`); a ranking that is not every item once is left out. For a round with a right order, `OrderGame` stays the tool.

Components: ranking
