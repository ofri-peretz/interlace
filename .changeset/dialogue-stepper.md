---
'@interlace/ui': minor
---

New `DialogueStepper`: a `Dialogue` the reader steps through, one step of turns at a time. Each `DialogueStepper.Step` ends in `DialogueStepper.Choices`; a `Choice` reveals the step its `next` names, so a talk can branch, and choosing a step already on the path goes back to it. Back, "Show the whole conversation" and "Start over" sit below, with `labels` for another language. After a choice, focus moves to the new step's first choice (or to Back at the end) and the new turns are read out once through a polite live region; the step enters with a short fade behind `motion-safe:`. The server renders every step, and without JavaScript a `<noscript>` style shows the whole conversation with no controls.

Components: dialogue-stepper
Kind: Feature
