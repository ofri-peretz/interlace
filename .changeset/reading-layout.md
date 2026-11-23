---
'@interlace/ui': minor
---

New `ReadingLayout`: a long read with its table of contents. When the layout is at least 56rem wide, a `Toc` rail sits beside the text and stays in view (it scrolls on its own when taller than the screen). Narrower, the contents fold into an "On this page" `TocPopover` on a bar that sticks to the top of the column. The switch is a container query on the layout's own width, so it folds inside a narrow column or beside a sidebar with no prop. A page with a sticky header sets `--reading-offset` to the header's height, and the rail, the bar and every heading jump clear it.

Components: reading-layout
Kind: Feature
