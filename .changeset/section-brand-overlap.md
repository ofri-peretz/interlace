---
'@interlace/ui': minor
---

`Section` gets a `brand` tone, the full-bleed brand band (`bg-primary` with `text-primary-foreground`), and a new `overlap` axis (`none`, `sm`, `md`, `lg`). A Section with `overlap` drops its own top padding, pulls up by that depth and stacks above the band before it, so a card can straddle the edge of a brand band with no custom class: two Sections, the second with `overlap="md"`.

Components: section
Kind: Feature
