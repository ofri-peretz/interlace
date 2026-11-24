---
"@interlace/ui": minor
---

`Topbar` takes link groups, a quiet edge and a full-screen phone menu.

- **Link groups.** An entry of `links` can be `{ label, items }`, where each item is a link with an optional `description` and `icon`. From `collapseBelow` up, a group is a button that opens a panel of its items, built on Base UI NavigationMenu: arrow keys move between triggers, Enter opens a panel and focuses its first item, Escape closes it and returns focus, hover opens it after a short delay and the panel slides between groups. Following a link closes it. Below `collapseBelow`, each group is a labelled section of the menu, and `mobileNav="wrap"` opens groups out into the row. Plain links work as before.
- **`edge="scroll"`.** The bar sits clear over the top of the page, with no surface or border, and fades them in once the page scrolls under it. The default, `edge="always"`, is unchanged.
- **`menuSide="full"`.** The small-screen menu covers the whole screen, dropping from the top, with larger links.

New parts, installed with Topbar: `TopbarNav` (the wide row with groups) and `TopbarScrollEdge` (marks the header `data-scrolled`).

Components: topbar, topbar-menu, topbar-nav, topbar-scroll-edge

Kind: Feature
