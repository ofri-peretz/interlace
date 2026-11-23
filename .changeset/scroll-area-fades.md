---
"@interlace/ui": minor
---

ScrollArea now fades its top or bottom edge while there is more to scroll that way, so a box says "there is more" before anyone scrolls, also on systems that hide scrollbars. The fade is a mask driven by Base UI's own overflow measurements: it grows over the first 2rem of travel and is gone at each end, so the first and last lines are never hidden at rest, and it works on any background. It drops while the region has keyboard focus so the focus ring stays whole. Pass `fade="none"` for hard edges.

Components: scroll-area
Kind: Feature
