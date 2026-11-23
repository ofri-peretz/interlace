---
'@interlace/ui': patch
---

- `Grid`: the `lg`, `xl` and `2xl` gaps cap their column gap below `md` (rows keep the full gap), so a 12-column grid no longer scrolls sideways on a phone.
- `Callout`: the surface is opaque (the tint is laid over a solid page-colour fill) and the callout sets its own text colour, so it reads the same on a brand band, an image or the page.
- `Citation` `marker="chip"`: the pill is capped at 24 characters (or the line) and ends in an ellipsis; the whole text stays in its accessible name and the popover.

Components: grid, callout, citation
Kind: Fix
