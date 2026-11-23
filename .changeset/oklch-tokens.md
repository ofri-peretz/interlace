---
"@interlace/ui": minor
---

The brand palette is now written in `oklch()`, native controls follow the colour scheme, and the palette ships as a design-token file. Every `--interlace-*` colour was converted to the `oklch()` value that paints the same 8-bit sRGB pixel, checked in Chromium, so nothing on screen and no contrast ratio changes. A new `structure/scheme.css` sets `color-scheme` on `:root` and on `.dark` / `[data-scheme='dark']`, so scrollbars, form controls and `light-dark()` follow your theme. `ds.interlace.tools/tokens/interlace.tokens.json` carries both themes and schemes in the Design Tokens Community Group format for Figma, Tokens Studio and Style Dictionary, generated from the CSS and checked in CI.

Components: interlace-base

Migration: None. If your own code parsed `--interlace-*` values as hex, parse `oklch()` as well; the hex each value paints is in the token file.
