---
'@interlace/ui': minor
---

New ScrollText and FlipGroup. ScrollText is one large sentence the reader brings into focus by scrolling: its words go from `--muted-foreground` to `--foreground` in reading order on a ViewTimeline, so the browser drives it from the scroll position with no listener. It is read once by a screen reader, every word is always at AA contrast, and it is in full colour without ViewTimeline or under reduced motion. FlipGroup makes items glide to their new place when a list is sorted, filtered or reordered: give each a `data-flip-id`, render the new order, and it plays the difference (FLIP); new items fade in, `render` makes it the `ul` or `ol` itself, and under reduced motion items simply take their place.

Components: scroll-text, flip-group
Kind: Feature
