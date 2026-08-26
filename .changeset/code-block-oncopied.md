---
"@interlace/ui": minor
---

CodeBlock — onCopied seam + honest copy affordance

Components: code-block

`onCopied?(text)` fires after a SUCCESSFUL clipboard write with the
exact copied text — the measurement seam a receipts-honest consumer
needs. Past-tense name is a documented R17 deviation: native `onCopy`
already reaches the figure via `...props` and fires on selection-copy.
Honesty fix riding along: with no clipboard API available the button
used to flip "Copied!" without writing anything; it now stays quiet —
no success is claimed that didn't happen.
