---
"@interlace/ui": minor
---

ReadingStrand — reading progress as the brand's draw verb

Components: reading-strand

A single strand-a line pinned to the viewport top that draws itself as
the reader moves through the piece. Progress is state coupled to the
reader's own scroll (nothing animates on its own — no reduced-motion
variant to gate). Real `role="progressbar"` 0–100; measures at most
once per frame via a passive listener; the fill moves with
compositor-only `transform: scaleX`. `target` names the article element
by id so server pages need no client seam; falls back to the whole
document. SSR renders scaleX(0) — zero CLS.
