---
'@interlace/ui': minor
---

One goal for the whole room. `RoomGoal` is a shared meter with named milestones on the way and, when given, how many rounds in a row most of the room got right; a milestone the room passes lifts once and is announced once, and the meter reads as a labelled `meter` with its value in words. `games/room-goal-model` adds up contributions (`tallyRoomGoal`), counting each person once per round whatever order or how many times messages arrive, with an optional cap per person so the room gets there together, and counts rounds in a row above a bar (`roomStreak`).

Components: room-goal
