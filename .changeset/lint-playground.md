---
'@interlace/ui': minor
---

CodeEditor + LintPlayground — paste code, watch analysis light it up

Components: code-editor, lint-playground

**CodeEditor** (primitive): an editable code surface whose visual layer is
DIAGNOSTICS, not syntax colour — the other half of the CodeBlock pair. The
zero-sync layout trick: the textarea auto-grows (`rows` = line count) with
soft wrap off, so a highlight bar for line N sits at a fixed offset computed
from the line-height — no scroll listeners, nothing to drift; the
`leading-6`/`py-4` classes and the exported `LINE_HEIGHT_PX`/`PAD_Y_PX`
constants are one test-pinned contract. Bars are `aria-hidden` position,
never information, and severities differ by border, not hue alone.

**LintPlayground** (pattern): editor + findings list + status around an
INJECTED `lint: (code) => Promise<PlaygroundDiagnostic[]>` — the DS owns the
surface and ships no linting dependency; the app brings a web worker
bundling the real analyzer. Honesty rules, all test-locked: findings render
as text first; stale results never paint (sequence-numbered, resolutions
AND rejections); a failed analysis says "unknown, not clean" instead of an
empty list; and the footer prints the privacy fact that makes pasting real
code reasonable — analysis runs entirely in the reader's browser.

Both join the coverage ledger at 100/100/100/100.
