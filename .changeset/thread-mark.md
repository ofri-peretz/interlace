---
'@interlace/ui': minor
---

`ThreadMark`: Interlace's thread drawn as a state, in place of a spinner, an empty-box icon or a warning triangle. `woven` means done or connected, `drawing` loops the woven pair for loading, `loose` is one strand trailing off untied for an empty state, and `cut` is one strand snapped in two for an error. Sizes `sm`, `md` and `lg`. The mark is always hidden from assistive tech, so the words beside it carry the meaning; under reduced motion `drawing` rests fully woven. Pair it with `EmptyState` through the `icon` slot.

Components: thread-mark

Kind: Feature
