---
'@interlace/ui': patch
---

Two theme defects that only a browser could find, both of which read as "the theme system does not work".

`useTheme()` now keeps every instance in the SAME document in sync. Each instance owned private React state and only listened for `storage` events — which fire in OTHER documents — so a switcher in the nav updated itself and nothing else. A page with a switcher plus any second theme-aware component repainted the switcher and left the component on the previous theme, permanently.

Harbor now declares its dark palette for `[data-theme='harbor'] .dark` and `[data-theme='harbor'] [data-scheme='dark']` as well as the same-element forms. The bare `.dark` block is unscoped, so it means "Interlace dark": it re-declares every `--interlace-*` literal on whatever element carries it, and `[data-theme='harbor'].dark` needs both on the same element. A `<div class="dark">` anywhere inside a Harbor page therefore repainted that subtree in the default brand. `theme-contract-lock` now requires the descendant forms from every registered theme.

Components: theme-switcher
