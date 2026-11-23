---
'@interlace/ui': minor
---

Section padding and the h2 and h3 sizes are now fluid. They grow on one smooth curve from a 360px phone to a 1024px laptop, instead of jumping at the `md` and `lg` breakpoints.

- **New tokens:** `--spacing-section-tight`, `--spacing-section-comfortable` and `--spacing-section-spacious`. They generate `py-section-*`, which `Section`'s `spacing` prop now uses.
  - tight: 48px to 80px
  - comfortable: 64px to 96px
  - spacious: 80px to 128px
  - Each step still clears the layout floors: 40px or more on a phone, and 64px or more by 768px.
  - A brand retunes the rhythm by re-pointing one variable, such as `:root { --spacing-section-comfortable: 5rem; }`.
- **Headings:**
  - `--text-h2` runs from 24px to 30px. It was a fixed 30px.
  - `--text-h3` runs from 22px to 24px, so it stays above h4 on a phone.
  - h4 and smaller, and body text, stay fixed.
  - Every clamp keeps a rem term, so sizes still scale with zoom and the user's font size.
- **Overlap:** the `overlap` variants on `Section` need a single `pt-0` now, not one per breakpoint.

Components: section, typography
Kind: Feature
