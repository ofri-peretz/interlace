---
'@interlace/ui': patch
---

DialogueStepper works when a server component renders it, and its no-JS fallback shows every step.

- `DialogueStep` takes its choices through a new `choices` prop. A server component holds only a reference to each client part, so a `DialogueChoices` child could not be told apart from a turn: it landed inside the list of turns and stayed after the reader moved on. Use the named exports (`DialogueStep`, `DialogueChoices`, `DialogueChoice`) from a server component, since the dot form is undefined there.
- `DialogueChoices` now hides itself once its step is past, wherever it renders, and the stepper warns when choices land inside a list of turns.
- Pending steps hide with a class instead of the `hidden` attribute. Tailwind's preflight rule for `[hidden]` is `!important` in a cascade layer, which beat the no-JS style, so only the first step showed with scripting off.

Components: dialogue-stepper
Kind: Fix
