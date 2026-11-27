---
'@interlace/ui': patch
---

Previous and next post links, the guess-reveal choices and the recall card ratings now pick their columns from their own width, not the window's, so a narrow column on a wide screen stacks them. The stat strip and prev/next skeletons use the same tracks as the real blocks, so nothing reflows when content arrives.

Components: prev-next-post, guess-reveal, recall-card, skeleton
