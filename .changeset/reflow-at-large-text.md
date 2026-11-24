---
"@interlace/ui": patch
---

Pages reflow at 150% text size on a phone (WCAG 1.4.10). `text-display` and `text-h1` also stop at a share of their container (12.5cqi and 11.5cqi), so one long word in a hero no longer runs past a 390px screen when the reader enlarges text; at 100% the cap never bites from 360px up. `Topbar` wraps its actions to a second line when the logo and actions don't fit on one, instead of pushing the row past the screen edge.

Components: interlace-base, topbar
