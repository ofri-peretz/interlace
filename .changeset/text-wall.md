---
'@interlace/ui': minor
---

A wall of the room's short answers for a shared screen. `TextWall` shows posts newest first, row by row, in a grid that follows its own width, with a count read as text (not a live region, so a screen reader user reads at their pace) and an optional `spotlight` that lifts one post above the rest, large. Posts already on the wall when it loads stay still; each later one rises in at the top (200ms) while the others glide one place along, and a post moved into the spotlight scales in (250ms); under reduced motion they simply appear. `max` caps the wall (40 by default) while the count stays the whole room. Phones send with `QuestionAsk`, relabelled, and posts go through the Q&A board's checks and moderation queue, so nothing unreviewed reaches the screen.

Components: text-wall
