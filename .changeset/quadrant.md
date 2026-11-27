---
'@interlace/ui': minor
---

A 2 x 2 grid: two questions at once. `Quadrant` is the phone: a square pad where the viewer places one dot by tapping, dragging or the arrow keys (Shift for fine steps, Home and End for the ends of the horizontal axis, Page Up and Page Down for the vertical), with the dot's place said in words as it changes and mirrored in right to left. Once placed, it shows the room on the same grid: where dots crowd, how many sit in each quarter, the room's middle travelling from the viewer's dot to where the room is, and an earlier round as a dashed ring; the picture is hidden from assistive tech and told in one focused sentence. `QuadrantMap` is the same picture for a shared screen. `games/quadrant-model` cleans and bins the dots (`summarizeQuadrant`), finds the leading quarter (none on a tie), measures how far the middle moved (`quadrantShift`) and moves a dot by key (`nudgePoint`).

Components: quadrant
