---
'@interlace/ui': minor
---

New `Wordmark`: a name set in more than one script, stacked, with each `Wordmark.Line` carrying its own `lang` and `dir`. `variant="sign"` is a street-sign plate with an inset rule; `plain` is the lines alone in the text colour. With `href` the whole lockup is one link named by `label`; without, it is an image of text. A line in Arabic uses `--font-arabic` when the site defines it; loading the font stays with the site. `Topbar`'s row is now at least 3.5rem and grows to fit a taller logo instead of clipping it.

Components: wordmark, topbar
Kind: Feature
