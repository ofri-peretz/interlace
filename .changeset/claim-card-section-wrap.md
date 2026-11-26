---
'@interlace/ui': patch
---

fix(ui): A ClaimCard section's title and meta wrap as one run of text. On a narrow card they were two flex items, so "Facts and sources (8 of 10 fully sourced)" split into two squeezed columns; the meta now follows the title and drops to the next line whole.

Components: claim-card
