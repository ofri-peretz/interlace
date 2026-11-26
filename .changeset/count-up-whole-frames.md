---
'@interlace/ui': patch
---

CountUp: frames are rounded to the decimals of the target, so a count to 40 never shows 39.815.
A `format` with its own fraction digits keeps them.

Components: count-up
