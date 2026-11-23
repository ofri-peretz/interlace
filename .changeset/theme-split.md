---
'@interlace/ui': major
---

Adding a component no longer restyles your app. Every component used to depend on `theme`, which swapped your `font-sans` and `font-mono` for Inter and JetBrains Mono, set `img { display: block }`, drew an outline on every focusable element and recoloured `body`. Components now depend on `interlace-base`, which only adds tokens. A test compiles a stock shadcn `globals.css` with and without it and checks the app's own utilities come out the same. The Interlace look is now opt-in: `theme` is a `registry:theme` that writes shadcn cssVars into your `:root` and `.dark`, and `interlace-foundation` carries the fonts, the page preflight and the fumadocs bridge. Interlace's `animate-accordion-down/up` no longer replace tw-animate-css's versions.

Components: interlace-base, theme, interlace-foundation

Kind: Breaking

Migration: Your `globals.css` decides how much of Interlace you get.

1. Components only, with your own look: `@import "./styles/interlace/base.css";` after `@import "tailwindcss";`. This is what the CLI installs with every component.
2. Add the Interlace palette and radius: `npx shadcn add @interlace/theme`. The CLI writes the variables into your `:root` and `.dark`.
3. Keep the full Interlace page (what `theme` gave you before): `npx shadcn add @interlace/interlace-foundation` and import `./styles/interlace/index.css` instead of `base.css`. Load Inter and JetBrains Mono yourself, as before.
