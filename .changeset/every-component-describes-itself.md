---
'@interlace/ui': patch
---

Every component now describes itself, and 59 gained a file header.

`description` said `"@interlace/ui — accordion (shadcn-compatible)."` for 128
of 137 items — the item's own name, restated. That field is what `shadcn add`
prints in your terminal, what the shadcn directory lists us under, what every
card on the storefront shows, what `<meta name="description">` and OG carry,
and what an agent reads to choose between two components. All of it said
nothing.

The sentence already existed in each component's header and was already being
extracted — into `agent-index.json`, the one surface an adopter never looks at.
It is now derived once and published everywhere. Boilerplate descriptions went
128 → 0 and empty `topics` 72 → 19.

What reaches your tree: the 59 components that gained a file header now carry
that header in the installed copy. It is a comment block — no behaviour, no
class names and no exports change. Everything else here is registry metadata
that never leaves our side.

Components: none
