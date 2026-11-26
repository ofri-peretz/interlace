---
'@interlace/ui': minor
---

Brainstorm, then choose. `DotVote` gives each person a few dots to spread across a brainstorm's ideas, two on one idea if they feel strongly, then ranks the ideas as the room's dots arrive, each glide explaining a change of rank. Every button names its idea, the dots left are announced, and the viewer's own dots are named in the results. `games/dot-vote-model` makes a ballot valid (`cleanBallot`: known ideas, whole counts, a cap per idea and in all), counts what is left (`dotsLeft`), and ranks ballots keyed by person (`tallyDots`), so a ballot sent twice counts once and ties keep the ideas' order on every screen.

Components: dot-vote
