---
'@interlace/ui': minor
---

Live rounds move. `AnswerPad` plays the reveal: the right tile lands, the tiles nobody needs step
back, a wrong pick gives one small nudge, and a right pick's points rise from its tile (transform
and opacity only; nothing moves under reduced motion). New `Standings`, the board between rounds:
each player's points pop in, totals count up from where they were (CountUp), then the rows glide
to their new places (FlipGroup) with places gained in words. An ordered list, ranks shared on ties.

Components: answer-pad, standings, live-room
