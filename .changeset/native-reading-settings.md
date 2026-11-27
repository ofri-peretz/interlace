---
"@interlace/native": minor
---

A text size control and an opt-in AAA More contrast mode for native, the same as the web kit's reading settings. `InterlaceProvider` takes `textSize` (100, 112, 125 or 150%, multiplying every type role on top of the device's own size) and `contrast` (`more`, `normal` or `system`, which follows iOS Increase Contrast). More contrast paints an AAA palette over any theme and brand; a brand may name its own primary pair with `overrides.moreContrast`. `TextSizeControl` and `ContrastToggle` are controlled and translatable, `parseReadingPrefs` and `serializeReadingPrefs` are for the app's own storage, and `auditPalette(palette, 'AAA')` holds a brand to the same floor. The package stores nothing.

Components: none
