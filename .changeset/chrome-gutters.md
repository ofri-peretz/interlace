---
'@interlace/ui': patch
---

`Topbar` and `Footer` take `Container`'s gutters (`px-4 xs:px-6 lg:px-8`) instead of a flat `px-6`, so the logo and the footer line up with the page content at every width. On a 320px phone the topbar row also fits a logo and two actions on one line again (gap `x-3` below `xs`), instead of wrapping to a second row.

Components: topbar, footer
