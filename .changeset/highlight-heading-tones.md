---
'@interlace/ui': minor
---

Three additions for content sites. A `--highlight` / `--highlight-foreground` colour pair (amber, AAA text in both schemes and in Harbor) with a `highlight` Button variant, for the warm call-to-action that is not the brand primary. Badge gains `success`, `warning`, `info` and `highlight` tones. And a `--font-heading` token: Typography h1–h6 and the hero headings read it, it falls back to `--font-body`, and `--font-body` now follows the app's own `--font-sans`, so a shadcn app's typeface reaches Interlace components with no setup. Set `--font-heading: var(--font-serif)` to give headings a serif without touching body text.

Components: button, badge, typography, hero, hero-cosmic, interlace-base, interlace-foundation, theme

Kind: Feature
