---
'@interlace/ui': minor
---

Three more pieces in the games tier.

- `DailyPuzzle`: the frame around a daily game. Its name, today's number and date ("No. 42 · Tuesday, November 24"), progress through the rounds in words ("Round 2 of 3", announced politely), an `aside` for a compact Streak, and the round itself as children, rising in once per round. `DailyPuzzleCountdown` says "Next puzzle at midnight" in the server HTML, then the time left in the player's zone, and calls `onNextDay` when the day turns.
- `ShareCard`: how the player did without spoiling it, one mark per round (a band, never the answer), the score and the streak. Share opens the device's share sheet where there is one; Copy always works and falls back to a selected field. The marks are read as a sentence for assistive tech. `games/share-model` exports `shareText` and `shareMarks`, so a server can build the same text.
- `Leaderboard`: a group's board as a captioned table. Ties share a rank ("=2"), the viewer's row says "You" and stays visible below the top rows, and `minPlayers` holds the board back until no score stands alone. `games/leaderboard-model` exports `rankEntries` and `buildBoard`.

Components: daily-puzzle, share-card, leaderboard
