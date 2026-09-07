---
"@interlace/ui": minor
---

CodeBlock — Shiki notation contract: highlighted + diff lines

Components: code-block

Lines a highlighter marks `highlighted`, `diff add`, or `diff remove`
(Shiki's `transformerNotationHighlight` / `transformerNotationDiff`, or
anything emitting the same classes) are now styled by the block itself:
token-backed washes that hold in both themes, edge-to-edge bleed through
the pre's padding, and a `+` / `-` gutter marker so a diff is never
color-alone. The copy button yields the post-diff code — `.diff.remove`
lines are skipped — so nobody pastes the line they were told to delete;
`select-none` nudges drag-selection the same way (a hint engines apply
unevenly, not a clipboard barrier — the button is the guarantee).
