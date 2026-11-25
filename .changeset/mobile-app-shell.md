---
'@interlace/ui': minor
---

A mobile app shell. `AppShell` is the frame: a column at least `100dvh` tall with a sticky header, a `<main>` (the SkipLink target) and a sticky tab bar, nothing fixed-position, so the last line of content always clears the bar and an on-screen keyboard never drags a bar into the page. `TabBar` holds three to five links with an icon and a word; the current one (`currentHref`, which keeps a parent tab current on its child pages) gets `aria-current="page"`, a filled pill that grows in from the middle and a heavier label, and a tab can carry a count or a dot with words for assistive tech. `hideFrom` hides it where a Topbar takes over. `AppHeader` is the view's bar: back, title and actions, sticky, clear of the notch, with its surface only once content scrolls under it; `largeTitle` sets the title big and moves it into the bar on scroll, read once. `AppHeaderBack` is the back link, its arrow mirrored in RTL. Every part pads itself by `env(safe-area-inset-*)` for a page added to a home screen (`viewport-fit=cover`). Under reduced motion the pill, surface and title simply change.

Components: app-shell, app-header, app-header-edge, tab-bar
