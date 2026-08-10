---
'@interlace/ui': patch
---

The fourteen `blocks/*` re-export aliases now name the release they disappear
in. They previously said "removal scheduled for one release cycle after the
architecture PR lands", which is not a date anyone can plan around — so the
aliases were, in practice, permanent. They are now `@deprecated since 1.0.0 —
removed in 2.0.0`, and removal will land as a breaking change with a migration
note.

Kind: Changed
Components: article-card, author-byline, code-window, empty-state, figure,
hero, newsletter-form, page-header, prev-next-post, related-posts,
section-header, share-buttons, sign-in-form, stat-card
Migration: Nothing changes today — `@interlace/ui/blocks/<name>` still
resolves. Before 2.0.0, change those imports to
`@interlace/ui/patterns/<name>`; the exported names are identical.
