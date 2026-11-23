---
'@interlace/ui': major
---

The stylesheets are now four layers, one directory each, and your classes always beat them. Page preflight used to sit in a custom `interlace.preflight` cascade layer, which ranks above Tailwind's utilities: `img { height: auto }` beat a call-site `h-10`, and `svg { display: block }` beat `inline`. Preflight now sits in Tailwind's `base` layer, prose and animation classes in `components`, and the three named Interlace layers hold custom properties only. A new lock (`css-layer-lock.test.ts`) keeps each layer reading only the one before it.

Components: interlace-base, interlace-foundation

Kind: Breaking

Migration: Only deep imports move; `styles/index.css` and `styles/base.css` are unchanged.

- `styles/interlace-theme.css` → `styles/brand/interlace.css` (values) and `styles/semantics.css` (bindings)
- `styles/themes/harbor.css` → `styles/brand/harbor.css`
- `styles/tokens.css` → `styles/structure/motion.css`
- `styles/foundation.css` → `styles/structure/type.css`, `structure/layout.css`, `structure/radius.css`
- `styles/fonts.css`, `styles/preflight.css` → `styles/page/fonts.css`, `styles/page/preflight.css`
- `styles/theme.css` → `styles/page/fumadocs.css` and `styles/page/shiki.css`

The layers `interlace.primitives`, `interlace.foundation` and `interlace.preflight` no longer exist. If you overrode one of them, move the rule into your own CSS; it no longer needs a layer to win.
