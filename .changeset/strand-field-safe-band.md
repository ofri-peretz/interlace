---
'@interlace/ui': patch
---

StrandField planes keep a vertical safe band

Components: none

Planes sit at `inset-x-0 top-6 bottom-6` instead of `inset-0`: the field
clips in screen space, and a plane at `translateZ` under the stage's
`rotateX` projects its top edge ~20px above its own box — a strand whose
line or label ended high was losing its top half to `overflow-hidden`
(found walking the blog's `/loom` at 375 and 320).
