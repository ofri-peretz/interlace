---
"@interlace/ui": patch
---

Hero no longer hides its media slot from screen readers. It used to set `aria-hidden` on any non-string media, which hid an interactive panel or a form while leaving it focusable. The media is now read by default; pass `mediaRole="decorative"` for ornament. The vertical padding moves to `py-section-comfortable`, the same fluid curve as Section.

Components: hero
Kind: Fix
