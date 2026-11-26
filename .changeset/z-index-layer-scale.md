---
"@interlace/ui": minor
---

Interlace has one named z-index scale. `interlace-base` adds `--z-index-*` steps, so `z-backdrop`, `z-base`, `z-raised`, `z-sticky`, `z-header`, `z-indicator`, `z-overlay`, `z-modal`, `z-popover`, `z-toast`, `z-tooltip` and `z-skip-link` are utilities, and an app retunes the order with `--z-index-*` on `:root`. Every component now uses a name instead of a number. Topbar, AppHeader and TabBar sit on `z-header`, above anything inside the page: before, they were `z-10` like a Section overlap band, ScrollStory steps and a Dialogue speaker, which tied and painted over the sticky header while scrolling. ScrollStory and Dialogue isolate their own layers. Popover and Tooltip set their layer on the positioner, so it reaches the page, and a select or menu inside a dialog opens above it. Numeric `z-10` and friends still work in your app.

Components: interlace-base, topbar, app-header, tab-bar, section, scroll-story, dialogue, reading-layout, article-card, timeline, timeline-map, topbar-nav, pull-to-refresh, cta-section, focus-grid, hero-cosmic, sheen, pointer-surface, sky-backdrop, grid-field, gradient-mesh, tooltip, drawer, dropdown-menu, toast, dialog, alert-dialog, combobox, sheet, popover, context-menu, select, reading-strand, card, skip-link, order-game
