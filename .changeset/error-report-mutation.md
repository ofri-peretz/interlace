---
'@interlace/ui': patch
---

The error-report rules are now held by tests at a mutation score of 100 percent. Two helpers lost a branch that could not change the result (`trimStack`, the stored-row `count`), the device log awaits `save` through `Promise.resolve` instead of a hand-written thenable check, and an id, the stack length option and the order of kept reports now have tests of their own. No behaviour change.

Components: error-report-model
