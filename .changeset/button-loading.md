---
"@interlace/ui": minor
---

Button takes `loading`. The button keeps its place, its width and keyboard focus while the reader's action runs: the label keeps its space but stops painting, a spinner sits over the middle in the label's own colour, and nothing beside it moves. It sets `aria-busy` and `aria-disabled` rather than `disabled`, so focus is not dropped to the page, and it ignores clicks (a form submit included) until `loading` is false, so a double press cannot send twice. The spinner stands still under reduced motion. LOADING_PHILOSOPHY gains a "busy button" section.

Components: button
Kind: Feature
