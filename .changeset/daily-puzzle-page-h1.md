---
'@interlace/ui': patch
---

fix(ui): DailyPuzzle `size="page"` sets the title at `text-h1 tracking-display`, as Typography's `h1` does, so a daily-game page's title matches every other page title. It was `text-section tracking-heading`, one step smaller. `size="default"` is unchanged.

Components: daily-puzzle
