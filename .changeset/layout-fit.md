---
"@interlace/ui": minor
---

Layout fixes found on a real wide-screen page:

- Timeline: in a wide column each event gets at least 13rem. More events than fit wrap onto a second row with its own rule, instead of squeezing into thin strips.
- Container: `prose`, `content` and `wide` read `--container-prose`, `--container-content` and `--container-wide`, the same tokens as Topbar and Footer, so retuning a token moves every edge together.
- Topbar: row links never wrap onto two lines, and a new `collapseBelow` prop (`md`, `lg`, `xl`; default `md`) sets the width below which the links move into the menu.

Components: timeline, container, topbar
Kind: Fix
