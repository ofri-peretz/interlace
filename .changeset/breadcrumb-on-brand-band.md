---
"@interlace/ui": patch
---

`Breadcrumb` reads on a brand band. Inside `Section tone="brand"` the trail, the current page and the separators take the band's own text colour instead of the page's greys, which sat at about 1.2:1 on the primary fill. Measured on the house theme: 8.8:1 light, 11.8:1 dark, and over 16:1 under More contrast. The current page keeps its weight, and a link underlines on hover instead of changing colour. Outside a band nothing changes.

Components: breadcrumb
