---
'@interlace/ui': minor
---

TimeSeries draws itself — the weave-reveal motion contract

Components: time-series

The plotted series (and the annotations riding them) are now revealed by a
clip rect that scales open left→right on mount — the shuttle pass — via the
new `--animate-weave-reveal` token: the draw verb's second mechanism, for a
chart whose dash patterns ARE series identity and cannot take the
stroke-dashoffset trick (MOTION_PHILOSOPHY's draw-gesture exception, amended
with the clip-reveal clause; the motion lock verifies the utility only ever
lands on a `clipPath` child). Pure CSS, so an SSR'd chart draws before
hydration; from-only keyframe, so with no animation at all — reduced motion,
jsdom, old engines — nothing is ever hidden.

The reveal replays when the drawn GEOMETRY genuinely changes: a value
comparison (composition, key range, y domain), never array identity, so a
parent re-rendering with fresh literals does not replay the draw. The same
change resets the crosshair during render — an old slot index would pair the
aria-live readout with the wrong date. And the crosshair now glides between
slots on a transform transition (150ms, `motion-reduce:transition-none`);
the readout still snaps — the readout is the record, the glide is the
gesture.
