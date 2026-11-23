---
'@interlace/ui': minor
---

`ThreadSteps`: an ordered sequence held together by Interlace's woven thread. Each step has a knot, and two strands cross to the next knot, drawing in as the reader reaches the step. Use it plain for "how it works" or "how we checked this". Set `state` (`complete`, `current`, `upcoming`) to make it a progress tracker: complete steps are woven, the current knot is ringed and marked `aria-current="step"`, and the thread ahead is a loose dotted strand. Every state is also in words for assistive tech. The server HTML is fully drawn; reduced motion keeps it that way.

Components: thread-steps

Kind: Feature
