---
'@interlace/ui': minor
---

`StatCard` and `StatGroup` get a `surface` prop. `card` (the default) is the bordered tile. `plain` drops the tile for a hairline rule above the number, so a few headline figures can sit on a page or a brand band like a line in a report. A plain stat takes its colour from what it sits on, label included, so it stays readable on `bg-primary`, and its number reads a size up.

`SectionHeader` gets `spacing="none"` for a header inside a Stack that already owns the gap, so the header no longer floats away from an aside under it.

Components: stat-card, stat-group, section-header
Kind: Feature
