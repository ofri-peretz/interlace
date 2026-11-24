---
'@interlace/ui': minor
---

New `Celebrate` effect for a moment someone earned: wrap the thing that earned it (a streak count, a score) and a ring and a burst of rays go out from it each time `play` changes, never on first render, so a restored page does not replay it. `CelebrateCheck` is a check mark that draws itself, and `vibrate` gives an opt-in matching tap (`tap`, `success`, `milestone`, `miss`) where the browser supports it. 600ms and 300ms, transform, opacity and stroke only, and nothing plays under reduced motion.

Components: celebrate
