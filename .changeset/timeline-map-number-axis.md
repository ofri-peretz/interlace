---
"@interlace/ui": minor
---

TimelineMap: number-axis mode — the lanes × axis landscape over any continuous measure

Components: timeline-map

New `axis` prop (`{ kind: "number", format }`) positions dots by
`item.value` instead of `item.date` — reading minutes, bundle KB, any
quantity a corpus is actually navigated by. Nice-step ticks (1/2/5×10ⁿ)
render through the consumer's `format`; aria-labels and the Detail
strip speak the formatted value through one shared voice, so the two
can never disagree. The date axis, the weave, and every interaction are
unchanged; `date` is now optional at the type level (number-axis items
don't need one).
