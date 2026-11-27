---
'@interlace/ui': minor
---

New ChoiceCard: big, tappable tiles for picking an answer, the topics a reader cares about or the kind of session a group wants. The whole tile is the control. `ChoiceCardGroup type="single"` is a radio group (arrow keys move the pick) and `type="multiple"` a group of checkboxes (Space toggles each); both take `value` / `onValueChange` / `defaultValue` and post with a form through `name`. Each `ChoiceCard` has a `title` (its accessible name), an optional `description` (its accessible description) and `media`. `layout="grid"` fills the row with tiles at least `--choice-card-min` wide; `layout="list"` stacks full-width rows. The pick never rests on colour alone, and a tile presses in while held except under reduced motion.

Components: choice-card
Kind: Feature
