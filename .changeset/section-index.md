---
"@interlace/ui": minor
---

SectionIndex — the numbered eyebrow

Components: section-index

A zero-padded mono numeral in strand-a beside an uppercase tracked
label, making the page's sections a legible sequence ("01 THE AGENDA …
04 THE PROOF"). The numeral counts the way a terminal counts (tabular
figures, monospace) and is the view's meaning-point accent; screen
readers hear "Section 2: The Agenda", never "zero two". No motion of
its own — pass `<DecodeText>` as the label for the decode gesture.
Drops straight into SectionHeader's `eyebrow` slot.
