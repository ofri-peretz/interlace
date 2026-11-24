---
'@interlace/ui': minor
---

Two pieces for telling a story with data. `TimeSlider` steps any chart through time: a play button, a slider with one stop per frame and the frame printed beside it; the chart is drawn by `children(frame, index)`, the server HTML holds the opening frame, play is started and stopped by the reader (and stops when the slider is touched), the thumb speaks the frame, and time runs right to left in an RTL page. Its pure steps (`nextFrame`, `playStart`, `clampFrame`, `formatFrame`) live in `charts/time-slider-model`. `ScrollStory` keeps a chart in view while the steps beside it scroll; `graphic(step)` redraws it when a step crosses the middle of the screen, never in proportion to scroll. Side by side from 48rem of its own box, the chart on top with the steps passing over it as cards below that, and every step in the server HTML.

Components: time-slider, scroll-story
