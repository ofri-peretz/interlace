---
'@interlace/ui': patch
---

Every focus ring is visible, whole, and clear of the text.

A keyboard audit of every story found three kinds of gap, now fixed:

- No visible focus: CollapsibleTrigger and a focusable TabsContent now show the system ring, 2px clear of the element. CodeEditor's textarea fills a clipping frame, so its ring is now inset, inside the padding and off the code. CodeWindow shows the ring on its frame when its body (a `<pre tabIndex={0}>`) has focus.
- Clipped rings: the ReadingLayout contents rail, SettingsTemplate's section nav, Scroller's viewport and GuessReveal's explanation scroll or clip their content, and cut the top and bottom off a focused link. Each now keeps a 4px margin for the ring, with no change to layout.

Components: collapsible, tabs, code-editor, code-window, reading-layout, settings-template, scroller, guess-reveal

Kind: Fix
