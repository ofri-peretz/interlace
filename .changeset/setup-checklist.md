---
'@interlace/ui': minor
---

New SetupChecklist: the few things a new member does to get going, in a card that shows how far they are and what to do next. Tasks (`SetupTask`) can be done in any order; the first one not done is put forward with its description and action, and carries `aria-current="step"`. Progress is a `progressbar` read as "2 of 5 done", with the same words beside it in a polite live region. A done task says Done in words, and its tick pops only when it is finished while the card is on screen. An optional `reward` ("+20 XP") rides beside each task. Once every task is done the card says so (`completeTitle`, `completeDescription`) and offers `onDismiss`.

Components: setup-checklist
Kind: Feature
