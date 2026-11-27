---
'@interlace/ui': minor
---

New Carousel: a row of cards the reader swipes through (updates, featured answers, what to play next). The row is the browser's own scroll with snap points, so touch, trackpad, wheel and the arrow keys all work at the device's own feel; `CarouselPrevious` and `CarouselNext` page by one view, switch off at either end and are not shown when every card fits. Every card is in the server HTML, announced as "slide, 2 of 6" in a region announced as a carousel (`positionLabel` translates it); nothing rotates on its own and nothing is cloned. Right to left, Next moves left and the arrows turn; under reduced motion a page jumps. `--carousel-item-size` and `--carousel-gap` size the cards. Part names follow shadcn's carousel.

Components: carousel
Kind: Feature
