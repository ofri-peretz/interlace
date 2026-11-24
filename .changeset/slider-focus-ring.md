---
'@interlace/ui': patch
---

`Slider` draws its focus ring on keyboard focus again. Base UI puts focus on a hidden input inside the thumb, so the thumb's own `focus-visible` ring never showed; the ring now also follows `has-[:focus-visible]`. Every slider gains it, including `CloserGame` and `TimeSlider`.

Components: slider
