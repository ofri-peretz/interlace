---
'@interlace/ui': minor
---

The editorial look is one line: `@theme { --font-heading: var(--font-serif); }` gives serif headings over the sans body. `CardTitle` now reads `font-heading` like every other heading in the kit, so card titles follow too; with the default `--font-heading` (your body face) nothing changes. `interlace-foundation` names a serif stack (Source Serif 4, then the system serifs) for `--font-serif`. A new Storybook story, Foundations/Typography/Editorial Headings, shows it.

Components: card
Kind: Feature
