---
"@interlace/ui": patch
---

TimelineMap — filter pills clear the SC 2.5.8 and AA floors

Components: timeline-map

The category filter pills rendered 22px tall (under the 24px target
floor of WCAG 2.2 SC 2.5.8) and hardcoded the count span to
muted-foreground, which measured 4.37:1 on the active pill's
strand-a/10 tint — under the 4.5 AA floor. Pills are now inline-flex
min-h-6; the count inherits the pill's state colour. Caught by the
blog's real-layout audit across every viewport.
