---
'@interlace/ui': minor
---

New DrawOn and Marker, editorial motion for line drawings and emphasis. DrawOn wraps any inline SVG and draws its stroked shapes as it scrolls into view, one after another (`order="sequence"`) or all at once, then fades in the fills. Marker is a `<mark>` whose highlighter stroke sweeps across a phrase from the inline-start edge, in `band`, `full` or `underline` shapes and `highlight` or `primary` tones. Both render the finished result on the server, run once, and are simply there under reduced motion.

Components: draw-on, marker
Kind: Feature
