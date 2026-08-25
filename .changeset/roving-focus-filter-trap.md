---
"@interlace/ui": patch
---

TimelineMap: filtering out the focused dot's lane no longer traps the
keyboard — a focus id outside the visible order falls back to the recent
end, so the composite always keeps exactly one tab stop.

Components: timeline-map
