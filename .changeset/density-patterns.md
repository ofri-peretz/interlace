---
'@interlace/ui': minor
---

Comfortable density now reaches the patterns too.

The Topbar row items, DialogueStepper's Back / Show the whole conversation / Start over, and Dialogue and DialogueStepper choices take their minimum height from `--spacing-control`, so they stay 36px by default and grow to 44px under `data-density="comfortable"`. Citation's number and chip markers keep their size in the line, and an invisible pad of the new `--spacing-target` token takes the tap: 24px by default (WCAG 2.5.8), 44px when comfortable. The underline marker is the phrase itself, inside a sentence, so it is unchanged.

Components: topbar, topbar-nav, dialogue, dialogue-stepper, citation, interlace-base

Kind: Feature
