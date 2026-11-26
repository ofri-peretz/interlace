---
'@interlace/ui': minor
---

feat(ui): DailyPuzzle takes `size="page"` for a page whose content is the puzzle. The title then sits at `text-h1`, the step Typography's `h1` uses, instead of `text-h3`, so a daily-game page no longer opens with a heading smaller than every other page's. `size="default"` is unchanged. The section carries `data-size`.

Components: daily-puzzle
