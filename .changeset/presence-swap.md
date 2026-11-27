---
'@interlace/ui': minor
---

New Presence and Swap, for content that arrives and leaves instead of popping in and out. `Presence` keeps a block on the page while it leaves (`show`, `effect` fade / rise / scale / blur, `appear`, `onExited`); `Swap` trades one version of its content for the next when `swapKey` changes (a quiz question for the next one, one step for another): the old one leaves, then the new one arrives, never both at once. `slide` moves along the reading direction and flips in a right-to-left page. Leaving content is `inert` and hidden from assistive technology, and when it held the focus, Swap hands focus to the new content. Only `opacity`, `transform` and `filter` move, timed by the brand's `--duration-*` and `--ease-*` tokens when they play; under reduced motion content simply appears and goes.

Components: presence
Kind: Feature
