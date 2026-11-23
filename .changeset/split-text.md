---
"@interlace/ui": minor
---

New SplitText: a headline that arrives a word, or a letter, at a time the first time it scrolls into view. `by` picks words or letters, `effect` is `rise` (default), `fade` or `blur`, and `step` sets the pace. The whole line is in the server HTML and read once from a visually hidden copy, so a screen reader never spells a word out. Letters keep emoji and combining marks whole, words never break mid-line, RTL arrives from the right, and under reduced motion the line is simply there.

Components: split-text
Kind: Feature
