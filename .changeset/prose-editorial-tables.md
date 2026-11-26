---
"@interlace/ui": minor
---

Prose tables read like an editorial table instead of a Markdown grid. The cell boxes, the shaded header and the zebra rows are gone: a firm rule sits under the header, a hairline between rows, body cells keep the reading size, the first cell carries the row's weight, figures line up, and a GFM column alignment is honoured. A `<span data-status="success|warning|info|destructive|neutral">` in a cell reads as a quiet status pill whose dot repeats the word. On a phone, a table with a header row stacks into one card per row, each value under its column name, with no sideways scrolling: Prose names each body cell after its column (`data-label`, which server-rendered markup can ship itself to skip a flash) and pins the table roles a screen reader would otherwise lose.

Components: prose
Kind: Feature
