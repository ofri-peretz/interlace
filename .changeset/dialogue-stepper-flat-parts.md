---
'@interlace/ui': major
---

`DialogueStepper` drops its dot aliases (`DialogueStepper.Step`, `DialogueStepper.Choices`, `DialogueStepper.Choice`). Its parts were already exported flat, and the dot form throws when a server component writes it, so there is now one spelling, the one that works everywhere. The file header gains a flow map and the stories a `Journey` that walks a branch, the end of the talk, Back, the whole conversation and Start over.

Components: dialogue-stepper

Kind: Breaking

Migration: replace `DialogueStepper.Step` with `DialogueStep`, `DialogueStepper.Choices` with `DialogueChoices` and `DialogueStepper.Choice` with `DialogueChoice`, and import them from the same file as `DialogueStepper`.
