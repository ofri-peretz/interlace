---
'@interlace/ui': minor
---

Site chrome that needs no custom classes:

- `Topbar` keeps its links on small screens. By default they move behind a Menu button that opens a side sheet (new `TopbarMenu`); `mobileNav="wrap"` shows them as a second row. `currentHref` marks the current page with `aria-current="page"` and a visible style, and `renderLink` now receives `aria-current` to forward.
- New `Banner`: a thin full-width bar for a site-wide message, in muted, info, success, warning and highlight tones, with an optional action and close button.
- `Prose` headings now use `--font-heading` (they used `--font-body` before), like Typography. If you set the two to different faces, Prose headings change to the heading face. New `width="fill"` drops the 65ch cap for prose inside a card or panel.
- `StatCard` and `StatGroup` take `layout="value-first"` (the number, then what it counts) next to the default label-first.
- `Footer` takes a `tagline` shown under the brand.

Components: topbar, topbar-menu, banner, prose, stat-card, stat-group, footer

Kind: Feature
