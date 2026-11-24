---
'@interlace/ui': patch
---

Touch targets and scrolling regions. `TabsTrigger` is at least `min-h-target` (24px, 44px under `data-density="comfortable"`) and `TabsList` grows to hold it. `SliderThumb`'s invisible hit area is now `size-target` centred on the knob, so it reaches 44px under comfortable density; the 20px knob looks the same. `Prose` makes a `<pre>` or `<table>` keyboard-focusable only when it actually scrolls sideways, names it (a table's `<caption>`, or a short label), re-checks on resize, and takes the attributes back when it fits. Attributes the author set always win.

Components: tabs, slider, prose
