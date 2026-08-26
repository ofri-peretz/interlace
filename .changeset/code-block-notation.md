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
color-alone. Copying a diff yields the post-diff code — `.diff.remove`
lines are skipped by the copy button and `select-none` for manual
selection, so nobody pastes the line they were told to delete.
