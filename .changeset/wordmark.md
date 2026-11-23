---
'@interlace/ui': minor
---

New `Wordmark`: a text logo of stacked lines (a name over its tagline, or one name in several scripts), with each `Wordmark.Line` carrying its own `lang` and `dir`. `variant="framed"` is a page-coloured plate with an inset rule in the brand colour; `plain` is the lines alone in the text colour. With `href` the whole lockup is one link named by `label`; without, it is an image of text. Lines use `--font-heading`; for another script, add its font to that stack and the browser picks per glyph. `Topbar`'s row is now at least 3.5rem and grows to fit a taller logo instead of clipping it.

Components: wordmark, topbar
Kind: Feature
