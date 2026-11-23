---
'@interlace/ui': minor
---

The Interlace page is warm paper now, not screen white. In light mode `--background` is #fdfbf8 and cards and popovers stay white, so they lift off the page the way a sheet lifts off a desk. In dark mode the page is a warm near-black (#0e0c0a) instead of a neutral one, matching the warm cards. Every text pair keeps its contrast floor: primary measures 8.52:1 on the paper and 7.23:1 on its own 10% tint, and `--input` 3.50:1 still clears SC 1.4.11. To keep a white page, set `--interlace-background: oklch(1 0 0)` in your own brand layer.

Components: interlace-base
Kind: Changed
