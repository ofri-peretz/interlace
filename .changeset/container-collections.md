---
"@interlace/ui": minor
---

Grids of repeated items now pick their column count from their own width, not the screen's. FeatureGrid, StatGroup, ArticleListGrid, PricingTable, RelatedPosts and StatStrip each set a CSS container on their root: one track below 28rem, two from 28rem, and the `cols` you asked for from 56rem. A grid placed in a sidebar or a dashboard card now collapses as it would on a phone, with no `className` override. At full page width the layout is the same as before.

Components: feature-grid, stat-group, article-list-grid, pricing-table, related-posts, stat-strip
Kind: Changed
