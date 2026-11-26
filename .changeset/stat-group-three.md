---
'@interlace/ui': patch
---

StatGroup with `cols={3}` goes from one track straight to three at a 36rem container, instead of two from 28rem and three from 56rem. On a tablet the two-track step left the third stat alone on its own row, which read as a missing one.

Components: stat-group

Kind: Changed
