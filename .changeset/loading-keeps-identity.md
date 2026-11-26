---
'@interlace/ui': patch
---

fix(ui): A loading Card or Badge keeps its `data-testid` and ARIA. The `loading` branch rendered a Skeleton with only `className`, so an E2E selector or an `aria-label` vanished for exactly as long as the content was loading. Card forwards all its props; Badge forwards `data-*`, `aria-*` and `id` (the rest are `<span>` props and the skeleton is a `<div>`).

Components: card, badge

Kind: Changed
