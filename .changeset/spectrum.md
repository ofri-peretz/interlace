---
'@interlace/ui': minor
---

`Spectrum`: where does a room stand between two poles? A statement, two pole labels and a slider (Base UI keyboard and drag, its value read in words: "Closer to …", "In the middle"). Placing the dot fires `onPlace` once and turns the slider into the room's picture on the same line: bars per bin with the viewer's bin in the accent, a marker for the room's middle that slides from the viewer's dot to the room's, and, with `before`, a dashed marker where the middle was in an earlier round. One sentence says it all for a screen reader and takes focus. `minResponses` hides the room until enough dots are in. The numbers are pure in `games/spectrum-model`: `summarizeSpectrum` (bins, median, middle half, mean), `spectrumShift`, `binOf`, `cleanValues`.

Components: spectrum
