---
"@interlace/ui": minor
---

TimelineMap: the reader's thread (`trace`)

Components: timeline-map

A new `trace` prop draws the reader's own path through the corpus —
ordered visited ids threaded dot-to-dot in warm strand-a over the cool
strand-b corpus web, with the draw verb (pathLength-normalized onto the
shared `strand-draw` keyframe; instantly complete under reduced
motion). The overlay is decorative and `trace.label` speaks the
summary ("Your thread: 7 of 82 read"). Unknown and filtered-out ids
skip, consecutive repeats collapse, and fewer than two visible points
draws nothing — a single visited dot is a beginning, not yet a thread.
SSR without the prop renders no trace: the honest crawler view, since
reading history is client-only.
