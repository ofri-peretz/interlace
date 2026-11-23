---
'@interlace/ui': minor
---

`Dialogue` reads as a chat transcript when you want it to. `speakers="inside"` sets each speaker's name as the first line of its bubble (one element, read once, in order). A turn's `tone` picks its bubble: `muted` and `accent` stay the defaults by side, and `inverse` is a high-contrast bubble in which a `Citation` chip flips to a light pill. New `Dialogue.Suggestions` and `Dialogue.Suggestion` give the row of follow-up pills under a transcript: a link with `href`, a button without, or your own element with `asChild`.

Components: dialogue
Kind: Feature
