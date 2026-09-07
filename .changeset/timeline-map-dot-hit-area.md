---
"@interlace/ui": patch
---

TimelineMap — dot links get a 24px hit area

Components: timeline-map

The visible dots can be as small as 10px — under the 24px target
floor of WCAG 2.2 SC 2.5.8, and genuinely hard to tap. Each dot link
now carries a transparent r=12 hit circle behind the painted dot:
pointer geometry grows to 24px, the visual stays the map's scale.
Caught by the blog's layout audit at every viewport.
