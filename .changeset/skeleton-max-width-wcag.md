---
'@interlace/ui': patch
---

fix(ui): Skeleton caps at its container width. Every width utility a caller reaches for is in REM, and rem scales with the root font-size — at text 200% a `w-48` skeleton is 384px on a 320px viewport and scrolls the whole document, failing WCAG 1.4.10 (Reflow). `max-w-full` goes on the base so it holds for every call site, including skeletons nobody has written yet; `className` still wins if a caller genuinely needs to exceed its container.

Components: skeleton

Kind: Changed
