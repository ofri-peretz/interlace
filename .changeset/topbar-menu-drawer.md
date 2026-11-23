---
"@interlace/ui": minor
---

TopbarMenu now opens its links in a Drawer instead of a Sheet: on a phone a finger drags the panel back toward its edge to close it, and the panel follows the finger. Focus trap, Escape, press-outside and close-on-navigate are unchanged. A new `side` prop (`right`, `left`, `bottom`; default `right`) picks the edge.

Components: topbar-menu, topbar
Kind: Feature
