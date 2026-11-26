---
'@interlace/ui': minor
---

feat(ui): Citation's `chip` pill caps at `--citation-chip-max-width` (default `24ch`, unchanged). A consumer whose publisher names run long, such as "Counter Extremism Project", raises it so the pill shows the whole name instead of an ellipsis one letter short. The popover still names every source in full.

Components: citation
