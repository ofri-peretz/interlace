---
'@interlace/ui': minor
---

New `games` tier, the engine of a daily game, starting with `Streak`: a player's run of days, a sentence on where today stands ("Play today to keep your streak.") and a strip of recent days marked played, rest, missed or still open. Rest days are a setting, not a special case: `rest={{ weekdays: [6], dates: ['2026-12-25'] }}` names days that never break a run, and a rest day the player plays anyway still counts. Today never ends a run while it is still open. Each mark pairs its colour with a shape and an icon, and every day is read out with its date and state; `variant="compact"` is one chip for a header. No hooks, so it renders on the server. The arithmetic ships beside it and is exported: `games/daily` (day keys in a time zone, puzzle numbers, a seeded puzzle-of-the-day that never repeats inside a cycle, time to the next day) and `games/streak-model` (`summarizeStreak`, `streakDays`, `isRestDay`).

Components: streak
