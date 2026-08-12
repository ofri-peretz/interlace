---
'@interlace/ui': patch
---

Six defects found by upgrading a real consumer, plus five found by reading the
components closely enough to document them.

**`Meteors`' glow never painted.** It read `var(--color-meteor-glow)` while its
`cssVars` declare `--meteor-glow`; `--color-*` is the Tailwind `@theme`
namespace and only `cssVars.theme` populates it, so the whole `box-shadow` was
invalid at computed-value time. **This was broken only for registry consumers**
— our own docs site hand-declares the `--color-` form.

**`ArticleCard` cropped 28% off every cover.** `h-44` is 176px; at a ~302px
tile that is a 1.72:1 box against a 2.381:1 image. Now `aspect-[1000/420]` —
the ratio the card already declared on its `<img>`. It also gains a
`renderImage` slot, because every Next.js consumer was re-patching the same
line to use `next/image` and the design system cannot depend on it.

**`BorderBeam` and `StarsBackground` had no `aria-hidden` at all** — six purely
decorative nodes a screen reader walked. **`CloudParticles` defaulted
`bodyColor` to `currentColor`**, painting volumetric clouds in the inherited
text colour. **`NumberTicker` gains `notation`**, because six-figure metrics
overflow a tile at 320px.

Also: `SheetCompose` and `DialogCompose` each mounted a second backdrop, so a
composed dialog dimmed the page twice as much as the hand-composed tree the
docs show; `Accordion` dropped `className` on the animated Panel; `Tooltip`
accepted `delay` and discarded it; `PopoverAnchor` was a second trigger.

**`useReducedMotion` was one frame late.** The canonical `useState(false)` plus
effect returns `false` on the first render, so every gated component painted
one frame of exactly the motion the user turned off. `useSyncExternalStore`
reads during render and closes that on client renders; on hydration the server
cannot know the preference, which is what the stylesheet reset is for.

`Badge` drops `'use client'` — verified with a real server-component build.

Components: meteors, article-card, border-beam, stars-background, cloud-particles, number-ticker, sheet, dialog, accordion, tooltip, popover, badge, use-reduced-motion
