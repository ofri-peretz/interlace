---
'@interlace/ui': minor
---

Duel by link: two players, one game, no accounts. `DuelInvite` sends the same game to a friend (the share sheet where there is one, copy link everywhere, the link to copy by hand when the clipboard fails). `DuelCard` is what the friend sees: who challenged them and the score to beat. `DuelCompare` shows both results round by round, with a verdict in words ("You won by 50 points."), a "Won" tag, rounds won, and bars growing out from the middle; a Celebrate burst marks the viewer's win. The challenge travels in the link: `games/duel-model` encodes the game, its seed and the first player's rounds as a base64url token (`encodeDuel`, `duelHref`), and `decodeDuel` reads it back as untrusted input, capped and cleaned, null when malformed. `compareDuel` gives each round's winner, the totals and the margin, with `order: 'asc'` for games where less is better. Every word goes through `labels`; motion is transform only and off under reduced motion.

Components: duel
