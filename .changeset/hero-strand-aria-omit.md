---
"@interlace/ui": patch
---

HeroStrand: aria-hidden omitted from the props type

Components: none

The always-decorative contract gains its type layer: `aria-hidden` is
Omit-ed from HeroStrandProps (strips autocomplete, rejects
object-literal construction). Measured honestly: TS checks aria-* JSX
attributes leniently, so the runtime override guard remains the
enforced layer — the source comment says exactly that.
