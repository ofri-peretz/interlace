---
"@interlace/ui": patch
---

FlipCard: focus follows a turn only when the card lands on the side the press asked for. A controlled parent that refuses a turn and later changes `flipped` on its own no longer pulls focus. The card also fills its grid cell (`h-full`), so a row of cards with different amounts of text lines up.

Components: flip-card
Kind: Fix
