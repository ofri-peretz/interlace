---
'@interlace/ui': minor
---

The Living Weave — motion, the radial poster form, and the strand field

Components: time-series, radial-weave

**TimeSeries draws itself.** The plotted series and their annotations are
revealed by a clip rect that scales open left→right — the new
`--animate-weave-reveal` token, the draw verb's second mechanism for a chart
whose dash patterns ARE series identity (MOTION_PHILOSOPHY's draw-gesture
exception gains the clip-reveal clause, and the motion lock verifies the
utility only ever lands on a `clipPath` child). Pure CSS, SSR-drawn,
from-only — with no animation at all, nothing is ever hidden. The reveal
replays when the drawn geometry changes BY VALUE, never by array identity;
the same change resets the crosshair during render. The crosshair now glides
between slots on a transform transition (150ms, motion-reduce clamped) while
the readout still snaps.

**RadialWeave** — the same series wrapped around a dial: the POSTER form.
300° sweep with the gap at the bottom (a closed circle claims the newest
observation meets the oldest), the exact dash+hue identity table TimeSeries
uses, nulls breaking the arc, an HTML centre value, and deliberately no
crosshair — the aria-label sentence, the min/max readout and the lossless
`SeriesTable` carry inspection. Server component; dial math lives in
`scale.ts` (`dialAngle`/`dialRadius`/`dialPoint`/`dialPath`/`dialRing`).

**StrandField** — real series lifted into depth: each thread on its own
plane in a CSS-3D perspective stage (zero dependencies — `perspective` +
`translateZ`, never WebGL), fanned apart or collapsed flat via `woven`,
tilting inside its own bounds with the pointer (never under
`prefers-reduced-motion`), strands entering by the strand-draw verb with a
CSS-variable stagger the reduce clamp can zero. `aria-hidden` theatre with
no focusable element; `onStrandSelect` is a pointer shortcut for a selection
surface the consumer renders accessibly.
