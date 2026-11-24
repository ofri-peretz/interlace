---
'@interlace/ui': minor
---

`ShareImage`: the picture a link unfurls into on X, LinkedIn, Facebook, WhatsApp, iMessage and Slack, as a tree Satori (Next's `ImageResponse`) paints, at 1200 × 630 or 1200 × 1200 (`size="square"`). A kicker, the title, a line of description, your mark and a label at the top, your address and a footnote at the foot, and one optional piece of evidence: a `stat`, up to five `bars`, or your own `visual`. The title steps down with its length and the room left, and the description is cut at a word. Image renderers cannot read CSS variables, so `patterns/share-image-model` reads your own theme file instead (`themeFromCss`: `:root` shadcn tokens, `var()` resolved, `oklch()` turned into hex), and `shareMeta()` writes the `openGraph` and `twitter` metadata with every image's size, type and alt. Satori has no bidi algorithm, so right-to-left text is broken into lines and put in drawing order before it sees it (`visualRtlLine`): Hebrew reads correctly, numbers and Latin runs keep their order, brackets mirror, and Arabic is shaped by the font engine (Cairo works; Noto Naskh Arabic throws in Satori). The card mirrors in right to left. A still: no motion.

Components: share-image
