---
"@interlace/ui": minor
---

SectionHeader sets its title on the fluid type scale instead of stepped `text-3xl md:text-4xl lg:text-5xl`, and takes its bottom gap from the section rhythm tokens instead of `mb-12` / `mb-16`. New `size="display"` for a page's loudest line, `eyebrowStyle="pill"` for a chip-style label, and `align="start"` now follows the writing direction. Two new type tokens, `--text-section` (28 → 40px) and `--text-display` (44 → 64px), are registered with `cn` so a colour never strips them.

Components: section-header
Kind: Changed
