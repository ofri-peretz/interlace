---
'@interlace/ui': minor
---

A picture guess. `PictureReveal` hides a picture under tiles that come away a few at a time as the presenter moves `step`, in a seeded order spread across the picture, so every screen uncovers the same tiles. Tiles leaving together fade and shrink with a 150ms stagger in all; under reduced motion they are simply gone. Each step can carry a text clue, shown and announced with the tiles, so someone who cannot see the picture plays the same round; the image has no text alternative until the reveal, when it gets `alt` and the answer is said. `games/picture-reveal-model` gives the order (`revealOrder`), the tiles off per step (`tilesAt`) and points that favour an early right guess (`guessPoints`). Phones guess with `TypeAnswer`.

Components: picture-reveal
