---
'@interlace/ui': minor
---

A pin on a picture. `PinDrop` lets each person place one pin on a map, floor plan or diagram by tap, drag or arrow keys, and says the pin in words (by the picture's named `regions` when given), so a screen reader user places the same pin. With an `answer` it is "Where is it?": on the reveal the answer scales in, a line joins it to the viewer's pin, and the points say how close it was; without one, the room's pins are the result. `PinMap` is the shared screen. `games/pin-drop-model` measures distance in widths of the picture, corrected for its shape (`pinDistance`), scores it (`pinPoints`), names a region (`regionOf`), moves a pin by key (`nudgePin`) and sums up the room (`pinSpread`).

Components: pin-drop
