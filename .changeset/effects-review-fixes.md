---
'@interlace/ui': patch
---

Fixes in the new backdrops. `Starfield` tints stars and meteors correctly when given an `oklch()` or `color-mix()` colour. `SkyBackdrop` rests every cloud fully inside the sky, so a cloud never jumps where it can be seen when its loop wraps. `GradientMesh` and `SkyBackdrop` add no content wrapper when `children` is `null`.

Components: starfield, sky-backdrop, gradient-mesh

Kind: Fix

Migration: none.
