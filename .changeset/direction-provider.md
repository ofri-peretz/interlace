---
'@interlace/ui': minor
---

New `DirectionProvider` sets the reading direction once for both layout and keyboard. `dir="rtl"` alone flips the CSS but not Base UI's behaviour, so sliders kept growing to the right and ArrowRight kept moving to the next tab in Hebrew and Arabic pages. Wrap the app (or a subtree in the other direction) in `<DirectionProvider direction="rtl">` and both follow. It renders a `display: contents` wrapper with `dir`, so it never changes layout, and re-exports `useDirection` for your own components.

Components: direction
