---
'@interlace/ui': minor
---

Plan a session, then send each person their recap. `SessionComposer` builds a session from modules: add, remove and reorder with named controls, a meter of minutes against `maxMinutes` that turns and says by how much when the plan runs long, `seen` modules marked for a group that had them before, and `required` modules (an opening, a close) that stay in place. Its rules live in `patterns/session-plan-model` (`cleanPlan`, `summarizePlan`, `fitsPlan`, `addToPlan`, `removeFromPlan`, `movePlan`, `canMove`), so a server checks a submitted plan the same way. `Recap` is one person's take-home page: what it covered, their numbers, their one thing this week, what they asked more about, and where to go next, each section shown only when it has something. `patterns/recap-model` (`encodeRecap`, `decodeRecap`) puts the per-person part in the link as versioned, validated base64url JSON, so a recap page needs no account and stores nothing.

Components: session-composer, recap
