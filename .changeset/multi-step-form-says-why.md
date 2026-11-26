---
'@interlace/ui': patch
---

MultiStepForm says what is wrong when a field fails its native check, not only where: the field's name (a radio group's own label) and the browser's message under the step (reworded with `labels.invalid`), and `aria-invalid` on the field until it is edited. Before, Continue only moved focus, so a sighted reader saw nothing happen. `MultiStepFormSummary` wraps a long answer (an email, a name) instead of pushing the page sideways at 320px.

Components: multi-step-form
