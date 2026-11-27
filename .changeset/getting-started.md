---
'@interlace/ui': minor
---

A getting-started checklist that makes progress feel real and never nags. `GettingStarted` shows a short list of steps (data the app passes: `ChecklistDef`, checked by `parseChecklist`), how far along the person is in words ("3 of 6 steps done"), the next step open, and a pace against a due date ("5 steps left, 4 days to go. On track."). Steps can be optional (skipping one unlocks what waited for it), wait for others, be weighted and grouped. A locked step is `aria-disabled` and focusable, and says what it waits for. A milestone line, the finish and an optional 1.2s burst (`celebrate="full"`) happen once and never on a reload or a merge from another tab; under reduced motion the burst is not mounted and the finish is a line of words. A streak, with rest days, reuses the games kit's `summarizeStreak` and is off unless asked for; no copy frames a missed day as a loss.

Progress is kept by a `store` (`load`, `save`, optional `subscribe`): `memoryStore` and `localStorageStore` ship, a server store is a few lines. A failed save keeps the progress on the page, says so once and retries at 2s, 8s and 30s; two tabs merge instead of overwriting (`mergeSnapshots` is commutative, associative and idempotent). The rules are pure and take the time as an argument (`getting-started-model`), so a test, an agent or a server replays any day. No new dependency.

Components: getting-started
