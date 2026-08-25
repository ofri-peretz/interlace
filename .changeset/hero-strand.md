---
"@interlace/ui": minor
---

HeroStrand — the thread at page scale

Components: none

One strand-a ribbon drawn across a hero section, optionally crossed by
the strand-b counter — the fourth and final scale of "One thread,
every scale". A server component with zero client JS: the draw is the
new `strand-draw` motion token (tokens.css, 600ms — the doctrine's
ceiling), so the preflight reduced-motion clamp reaches it and
reduced-motion users see the strand instantly drawn. Paths normalize
with `pathLength=100`; `vector-effect` is deliberately absent (the
Chromium screen-space-dash lesson from the first production weave).
Ships under `effects/` (not a registry item yet, like the rest of the
signature kit).
