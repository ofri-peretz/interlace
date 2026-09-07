---
"@interlace/ui": patch
---

TimelineMap — dot hit radius 12 → 13

Components: timeline-map

The nominal 24px hit union measured 23px in a real browser
(sub-pixel rounding), one under the SC 2.5.8 floor. r=13 carries a
2px margin; still paints nothing.
