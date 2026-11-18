---
'@interlace/ui': patch
---

fix(ui): Spotlight type-checks against motion 14. motion 14 added an `fx` boolean prop to every motion element, which clashes with the SVG `fx` focal-point attribute Spotlight inherited from its native `<svg>` props; installing Spotlight next to the latest motion failed `next build`'s type check. `fx` is now omitted from the native props, like the animation handlers and `values` before it.

Components: spotlight
