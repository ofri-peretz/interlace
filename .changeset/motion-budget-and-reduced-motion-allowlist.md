---
'@interlace/ui': patch
---

The three entry animations in `styles/theme.css` now run at 200ms with no
delay, and the reduced-motion class list in `styles/tokens.css` covers
`.animate-pulse`.

`.animate-fade-in-up` was 0.5s, `.animate-slide-in-left` 0.5s behind a 0.3s
delay, and `.animate-scale-in` 0.4s behind a 0.2s delay — up to 800ms before
the reader saw anything, against the 200ms entry ceiling
`MOTION_PHILOSOPHY.md` has always set. All three are now
`0.2s ease-out both`. The delays were the worse half: an entry animation is
already laid out at `opacity: 0`, so a delay is time spent looking at nothing.

Separately, `.animate-pulse` — the animation `Skeleton` renders on every
loading state — was missing from the `tokens.css` reduced-motion list, along
with `.animate-meteor` and `.animate-meteor-effect`. The universal clamp in
`styles/preflight.css` was already covering all three, so apps importing
`styles/index.css` were never affected; apps that import `tokens.css` and
`theme.css` à la carte and skip `preflight.css` were. All three are now
listed.

Both are held by `packages/ui/__tests__/motion-contract-lock.test.ts`, which
reads the ceiling out of `MOTION_PHILOSOPHY.md` rather than repeating it, and
fails if any bare `animate-*` utility in `packages/ui/src` is missing from the
list.

Kind: Changed
Components: theme, skeleton, meteors, stars-background
