---
'@interlace/ui': patch
---

fix(ui): Skeleton caps at its container width

Every width utility a caller reaches for is in REM, and rem scales with the root font-size. At text 200% a `w-48` skeleton is 384px on a 320px viewport and scrolls the whole document — WCAG 1.4.10 (Reflow). `w-96` and `w-80` skeletons in use would be 768px and 640px there.

`max-w-full` on the base, so it holds for every call site rather than needing to be remembered at each one. `className` still wins if a caller genuinely needs to exceed its container.
