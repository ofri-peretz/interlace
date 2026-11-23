---
'@interlace/ui': major
---

The last borrowed motion components are replaced with Interlace's own, written from scratch. Content that moves now renders in full on the server and is announced once; decoration is a layer you drop inside any component, so a button stays a `Button` and a card stays a `Card`:

- `CountUp`: a number that counts to its value when it scrolls into view. The server renders the final figure, the box never shifts, and `format` takes any `Intl.NumberFormat` options.
- `Scroller`: a looping row of items. Each item is announced and tabbed to once, a visible Pause button sits beside it, and under reduced motion it becomes a plain scrollable row.
- `StaggerList`: a real `ul` or `ol` whose items arrive one by one, once. Focus shows an item at once.
- `SheenText`: a few words painted with a slow travelling gradient, on text-grade tokens, with a forced-colours fallback.
- `Sheen`: a band of light that crosses its parent. Put it inside a `Button`; it sits under the label.
- `EdgeGlow`: a light that runs around the edge of a `Card` or any positioned element.
- `GridField`: graph-paper lines or a dot grid, with a few seeded (or chosen) cells that light up and fade, and with `interactive`, the cell under the pointer.

`Button` is now `relative isolate` and `Card` is `relative`, so `Sheen` and `EdgeGlow` work inside them with no extra classes.

Components: count-up, scroller, stagger-list, sheen-text, sheen, edge-glow, grid-field, button, card, number-ticker, marquee, animated-list, animated-gradient-text, shimmer-button, border-beam, animated-grid-pattern, interactive-grid-pattern, grid-pattern, dot-pattern, particles

Kind: Breaking

Migration: The `@interlace/ui/magicui/*` entry points and their registry items are removed. Replace `NumberTicker` with `CountUp` (`value`, `from`, `duration`, and `format` for decimals or compact notation), `Marquee` with `Scroller` (`direction`, `duration`, `gap`, `pauseOnHover`; children become list items), `AnimatedList` with `StaggerList` (it reveals once and does not loop), `AnimatedGradientText` with `SheenText` (`from`, `to`, `duration`), `ShimmerButton` with a `Button` that contains a `<Sheen />`, `BorderBeam` with `EdgeGlow` (`from`, `to`, `width`, `length`, `duration`), `AnimatedGridPattern`, `InteractiveGridPattern`, `GridPattern` and `DotPattern` with `GridField` (`mark="lines" | "dots"`, `cell`, `lit` or `cells`, `seed`, `fade`, `interactive`; `GridPattern`'s `squares` become `cells`), and `Particles` with `Starfield`.
