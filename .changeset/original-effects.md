---
'@interlace/ui': major
---

Interlace's own effects replace the backdrop set that was modelled on another library. Each one is written from scratch, coloured from theme tokens, still under reduced motion, hidden from assistive tech, and self-contained (no keyframes to add to your stylesheet):

- `Starfield`: stars, shooting stars and meteors on one canvas with one frame loop that sleeps out of view.
- `GradientMesh`: drifting glows of theme colour behind a hero or feature band.
- `ThreadLines`: a seeded bundle of crossing threads in the two strand colours, with a travelling glint.
- `SkyBackdrop`: a daytime sky with a sun glow and drifting clouds, turning to dusk in the dark scheme.
- `LightBeam`: a static cone of light, rendered on the server.
- `RotatingText`: a rotating headline word with no layout shift and one stable label for screen readers.
- `FocusGrid` (pattern): picture cards where the hovered or focused one stays bright, in pure CSS.

`HeroCosmic` now draws its sky with `Starfield`. Its `effects` bag is simpler: `starDensity`, `twinkleProbability`, `shootingStars` (`[min, max]` seconds, or `false`), `meteorCount` and `meteorDuration` (`[min, max]` seconds).

Components: starfield, gradient-mesh, thread-lines, sky-backdrop, light-beam, rotating-text, focus-grid, hero-cosmic, spotlight, background-beams-with-collision, background-gradient-animation, background-lines, cloud-particles, flip-words, focus-cards, stars-background, sunny-background, meteors

Kind: Breaking

Migration: The `@interlace/ui/aceternity/*` entry points, the `meteors` primitive and their registry items are removed. Replace `StarsBackground`, `ShootingStars` and `Meteors` with one `Starfield` (`density`, `twinkle`, `shootingStars`, `meteors`, `meteorDuration`). Replace `BackgroundGradientAnimation` with `GradientMesh` (`colors`, `intensity`, `spread`), `BackgroundLines` with `ThreadLines`, `SunnyBackground` and `CloudParticles` with `SkyBackdrop`, `Spotlight` with `LightBeam`, `FlipWords` with `RotatingText` (`words`, `interval`), and `FocusCards` with `FocusGrid` and `FocusGrid.Item` (`media`, `title`, `description`, `href`). `BackgroundBeamsWithCollision` has no replacement. In `HeroCosmic`, `minTwinkleSpeed`, `maxTwinkleSpeed`, the `shooting*` speed and delay keys and `meteorMinDuration` / `meteorMaxDuration` are replaced by `shootingStars` and `meteorDuration`.
