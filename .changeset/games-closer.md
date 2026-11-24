---
'@interlace/ui': minor
---

New `CloserGame` in the games tier: guess a number by sliding to it (or typing it), lock it in, and the answer slides out from the guess to where it really is, with the gap shaded and said in words ("You said 450. The answer is 500, 50 off. Close. 90 points."). Distance is a share of the range, so the same rule works for 0 to 100 and 0 to 100,000; `range.scale = 'log'` handles answers that span orders of magnitude. Numbers go through `Intl.NumberFormat` (`format`, `locale`), every word through `labels`. `guess` / `defaultGuess` restore a stored guess as the revealed state, and `onGuess` fires once with the scored result. The answer travels in 400ms on the reveal and is simply in place under reduced motion. Scoring is pure and exported from `games/closer-model` (`scoreGuess`, `toPosition`, `fromPosition`, `snap`), so a server can score the same guess and a share card can draw the band without the number.

Components: closer-game
