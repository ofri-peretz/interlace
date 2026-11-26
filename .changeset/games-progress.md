---
"@interlace/ui": minor
---

A sense of progress for daily games, without nagging. Streak gains `protection`: every few days played earns a shield (up to a cap) that covers one missed day, worked out from the played days alone so every device agrees; a covered day is marked with a shield and the strip says how many are held or how far the next is. New pure models: `progress-model` (XP and levels on a gentle curve, a daily goal, goal days, milestones crossed) and `reminder-model` (a daily .ics reminder the player keeps in their own calendar).

New components: GoalRing (a meter ring for today's goal), LevelMeter (level, XP bar that fills from before a gain, the gain chip), Milestones (reached, next and a few ahead), RoundSummary (the end-of-round moment: XP counted up, goal, streak kept, news, then the next step; celebrates once) and ReminderOffer (a quiet calendar nudge that sends nothing). ShareCard takes a `note` for a milestone share and leaves out an empty marks row.

Components: streak, share-card, goal-ring, level-meter, milestones, round-summary, reminder-offer
Kind: Feature
