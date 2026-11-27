---
'@interlace/ui': minor
---

Pairs, small groups and teams from one model. `games/groups-model` splits a room into balanced groups (sizes never differ by more than one, an odd pair becomes a trio), gives the same groups for the same seed so a refreshed host and a server agree, avoids putting the same people together again (`avoid`), adds late joiners to the smallest group and takes leavers out without a reshuffle, and totals team scores by sum or mean for `Leaderboard` (`teamTotals`). `GroupCard` is the phone's view: the group's name, who you are with (read as one sentence), what to talk about and an optional TimerRing. `GroupGrid` is the shared screen: every group with its people, where a reshuffle glides each name to its new group. A new group rises in on the phone within 200ms, names following within 150ms; under reduced motion everything is in place.

Components: groups
