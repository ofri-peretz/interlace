---
'@interlace/ui': minor
---

`Topbar` motion and focus polish.

- **Hover pill.** A soft pill slides under whichever row item the pointer is over, and rests under an open group's trigger.
- **Panels slide between groups.** Moving from one group to the next, the panel resizes and its content slides in the direction of travel. The items cascade in, 20ms apart, inside the 150ms stagger window.
- **`hideOnScroll`.** The bar slides away while the reader scrolls down and returns on the first scroll up. It stays put while focus or an open panel is inside it.
- **Menu cascade.** The small-screen menu's links fade in a quick cascade.
- **Focus ring.** Every row item is now a padded box, so the focus ring sits 2px outside it on the page colour and never touches the words. Rows of plain links now render through `TopbarNav` too, so they get the same pill and ring.

Everything that moves is behind `motion-safe`. Under reduced motion the pill and panels still appear, without moving.

Components: topbar, topbar-nav, topbar-menu, topbar-scroll-edge

Kind: Feature
