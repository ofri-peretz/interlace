---
'@interlace/ui': minor
---

The room's pulse while someone talks. `ReactionBar` gives a phone one round button per reaction kind (a neutral `DEFAULT_REACTIONS` set: love it, agree, funny, new to me, lost me; pass your own `kinds`), each popping on tap. `ReactionStream` lets every new reaction float up a shared screen with a slight drift and fade (1.6s, Web Animations, at most `maxFloating` at once, nothing on first load), and keeps a per-kind tally that screen readers read and that is the whole view under reduced motion. `RaiseHand` is a toggle that says the person's place in line and when it is their turn; `HandQueue` gives the host the line in order with call next, call on a named person, lower a hand and done. The rules are pure in `games/reactions-model`: `allowReaction` (a sliding per-person budget, 6 in 3 seconds by default), `tallyReactions`, and `createHands` / `applyHandEvent` / `placeInLine` (first raised, first called; lowering and raising again goes to the back).

Components: reactions
