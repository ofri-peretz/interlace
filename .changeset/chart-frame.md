---
'@interlace/ui': minor
---

New `ChartFrame`: the frame a published chart sits in. A `title` that states the finding (at the `headingLevel` the page needs) and a `subtitle` on what is measured sit above any chart; the footer names every `source` (linked when it has an address), a `note` on how to read the numbers and when they were `updated`, all as plain HTML under the chart. Pass `table` and the frame offers Chart and Table views as tabs, both kept in the server HTML. `download` writes the rows as a UTF-8 CSV into a link at render time, so it works before scripts load, and prefixes cells a spreadsheet would run as a formula. Every fixed word comes from `labels`, and the date goes through `Intl` in `locale`. `toCsv` and `csvHref` are exported and pure.

Components: chart-frame
