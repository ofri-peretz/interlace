---
'@interlace/ui': patch
---

Text alignment follows the writing direction everywhere.

Typography's `align`, Accordion triggers, the Dialog header, Prose table headers, PrevNextPost cards, SeriesTable and MetricTable used `text-left` and `text-right`, which put text against the wrong edge in a right-to-left page. They now use `text-start` and `text-end`, so the same markup is correct in English, Hebrew and Arabic. Left-to-right pages render exactly as before. A new lock keeps physical alignment out of the components.

Components: typography, accordion, dialog, prose, prev-next-post, series-table, metric-table, section-header

Kind: Fix
