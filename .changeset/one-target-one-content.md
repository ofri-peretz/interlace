---
'@interlace/ui': patch
---

`button`, `toolbar`, `skeleton`, `calendar`, `data-state`, `meter` and `stat-strip` ship their `.ts` helper (`button-variants.ts`, `skeleton-variants.ts`, `calendar-model.ts`, `data-state-model.ts`, `meter-scale.ts`) with the helper's version banner, byte for byte what the helper's own item ships. The inlined copy used to have no banner, so the file in your tree depended on which item you installed last and the upgrade diff could not date it. The build now fails when two items write one target with different content.

Components: button, toolbar, skeleton, calendar, data-state, meter, stat-strip
Kind: Fix
