---
"@interlace/ui": minor
---

Toggle — `pill` variant + `xs` size; TimelineMap.Filter consumes it

Components: toggle, timeline-map

The filter pill (rounded-full chip, strand-a pressed tint, greyscale-safe
border identity) is now a Toggle variant instead of classes open-coded
inside TimelineMap.Filter — every "which categories/threads are active"
surface styles from one home. `xs` is its native size: `min-h-6` sits
exactly on the WCAG 2.2 SC 2.5.8 24×24 target floor (min-height, so a
wrapped label grows the pill rather than clipping). TimelineMap.Filter
now renders these Toggles — Base UI carries `aria-pressed` — with no
visual change.
