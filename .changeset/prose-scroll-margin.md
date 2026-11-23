---
'@interlace/ui': patch
---

Prose headings keep their 4rem scroll offset again, so a linked heading no longer lands under a sticky header. The 2.0 spacing change left them on `scroll-mt-xl`, which no longer exists and compiled to nothing.

Components: prose
