---
"@interlace/ui": minor
---

FocusGrid and TestimonialGrid now pick their column count from their own width, not the screen's. TestimonialGrid sets a CSS container like the other collections: one quote per row below 28rem, two from 28rem, three from 56rem, so a quote card no longer squeezes to 210px on a 480px phone. FocusGrid uses intrinsic tracks with no breakpoint: a column drops when a card would fall below 16rem, 14rem or 12rem (for 2, 3 or 4 columns), and `columns` is now the most it shows. Both collapse inside a sidebar or a card with no `className` override.

Components: focus-grid, testimonial
Kind: Feature
