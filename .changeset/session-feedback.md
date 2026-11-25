---
'@interlace/ui': minor
---

After-session feedback, in two patterns. `InterestSignal` is "I want more on this": a toggle (`aria-pressed`, a name that never changes) with a status line that says "Noted" and how many others asked. `InterestBoard` is the host's view, ranked by `patterns/interest-model` (`rankInterest`): most-asked first, bars drawn against the top topic, the viewer's asks marked, and `minCount` holding back topics too small to be anonymous. `CommitmentPicker` asks each person to pick one thing to do this week, in one tap or in their own words, and says when they will be asked; `CommitmentCheckIn` is that question a week later (yes, partly, not yet). `patterns/commitment-model` says when the follow-up is due (`followUpAt`, `followUpState`) and what a room's answers add up to (`commitmentImpact`). Every word goes through `labels`; the only motion is a 200ms scale on the icon and a one-time bar growth, both off under reduced motion.

Components: interest-signal, commitment
