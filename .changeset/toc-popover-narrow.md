---
'@interlace/ui': patch
---

TocPopover works on a narrow screen with a long outline.

- The popover's height is capped at the room the screen has left (`--available-height`), and the list scrolls inside it. Before, an outline of 18 headings ran 906px tall and the later links fell off the bottom of a phone screen.
- Picking a link closes the popover, so it no longer covers the text it just scrolled to. Focus stays on the heading.
- `Toc` gives a heading `tabindex="-1"` before focusing it, unless the heading already has a tabindex. Before, the focus call did nothing on a plain heading. `Toc` also takes a new `onNavigate(id)` callback.

Components: toc
Kind: Fix
