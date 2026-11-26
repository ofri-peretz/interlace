---
'@interlace/ui': patch
---

`Callout` reads better on phones. Below `sm` a `kicker` sits above the body instead of beside it, so a long body keeps the full width rather than a column narrowed by the kicker, and the inset drops from `p-6` to `p-4`. From `sm` up nothing changes. The root carries `data-kicker` when a kicker is set.

Components: callout
